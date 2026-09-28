import 'dotenv/config';
import fs from 'node:fs/promises';
import { adminDb, adminStorage } from '../server-services';
import { createConfiguredPostgresDatabase, createPostgresMediaMetadataRepository } from '../server/infrastructure/postgres';
import { createCloudflareR2StorageAdapterFromEnv } from '../server/adapters/media-storage';
import type { MediaAsset, MediaObject } from '../server/domains/media/contracts';

const limit = Math.min(Math.max(Number(process.env.MEDIA_MIGRATION_LIMIT || 5000), 1), 10000);
const dryRun = process.env.MEDIA_MIGRATION_DRY_RUN === 'true';
const verifyOnly = process.env.MEDIA_MIGRATION_VERIFY_ONLY === 'true';
const reportPath = process.env.MEDIA_MIGRATION_REPORT || 'tmp/media-migration-report.json';

const r2 = createCloudflareR2StorageAdapterFromEnv();
if (!r2) throw new Error('R2_NOT_CONFIGURED');
const { pool } = createConfiguredPostgresDatabase();
const repository = createPostgresMediaMetadataRepository(pool, { publicBaseUrl: process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL });

const snapshot = await adminDb.collection('media_assets').limit(limit).get();
const report: { startedAt: string; completedAt?: string; firestoreCount: number; migrated: number; skipped: number; failed: number; verified: number; failures: Array<{ id: string; error: string }> } = { startedAt: new Date().toISOString(), firestoreCount: snapshot.size, migrated: 0, skipped: 0, failed: 0, verified: 0, failures: [] };

if (!verifyOnly) {
  for (const document of snapshot.docs) {
    const data = document.data() || {};
    const userId = String(data.userId || data.ownerUserId || '');
    const siteId = String(data.siteId || '');
    const originalPath = String(data.originalPath || '');
    if (!userId || !siteId || !originalPath || data.status === 'deleted') { report.skipped += 1; continue; }
    try {
      const existing = await repository.get(document.id);
      if (existing) { report.migrated += 1; continue; }
      const originalBytes = new Uint8Array((await adminStorage.file(originalPath).download())[0]);
      const originalKey = `sites/${siteId}/media/${document.id}/original`;
      const contentType = String(data.mimeType || data.sourceMimeType || 'image/webp');
      const original: MediaObject = dryRun ? { provider: 'cloudflare_r2', objectKey: originalKey, contentType, bytes: originalBytes.byteLength, cdnUrl: r2.getCdnUrl(originalKey) } : await r2.put({ objectKey: originalKey, bytes: originalBytes, contentType, cacheControl: 'public,max-age=31536000,immutable' });
      const asset: MediaAsset = { id: document.id, ownerUserId: userId, siteId, purpose: (['gallery', 'product', 'background', 'block', 'avatar'].includes(String(data.purpose)) ? data.purpose : 'gallery'), lifecycle: data.status === 'ready' ? 'ready' : 'processing', original, width: Number(data.width) || undefined, height: Number(data.height) || undefined, altText: typeof data.altText === 'string' ? data.altText : undefined, createdAt: String(data.createdAt || new Date().toISOString()), updatedAt: new Date().toISOString() };
      if (!dryRun) {
        await repository.create(asset);
        const thumbnailPath = typeof data.thumbnailPath === 'string' ? data.thumbnailPath : '';
        if (thumbnailPath) {
          const thumbnailBytes = new Uint8Array((await adminStorage.file(thumbnailPath).download())[0]);
          const thumbnailKey = `sites/${siteId}/media/${document.id}/thumbnail`;
          const thumbnail = dryRun ? { provider: 'cloudflare_r2' as const, objectKey: thumbnailKey, contentType: 'image/webp', bytes: thumbnailBytes.byteLength, cdnUrl: r2.getCdnUrl(thumbnailKey) } : await r2.put({ objectKey: thumbnailKey, bytes: thumbnailBytes, contentType: 'image/webp', cacheControl: 'public,max-age=31536000,immutable' });
          if (!dryRun) await repository.update(document.id, { thumbnail, lifecycle: asset.lifecycle, updatedAt: new Date().toISOString() });
        }
      }
      report.migrated += 1;
    } catch (error) { report.failed += 1; report.failures.push({ id: document.id, error: error instanceof Error ? error.message : 'MIGRATION_FAILED' }); }
  }
}

const migrated = await repository.listAll();
report.verified = migrated.filter((asset) => asset.original.provider === 'cloudflare_r2' && Boolean(asset.original.cdnUrl || r2.getCdnUrl(asset.original.objectKey))).length;
const expected = verifyOnly ? report.firestoreCount : report.migrated;
report.completedAt = new Date().toISOString();
await fs.mkdir('tmp', { recursive: true });
await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
await pool.end();
console.log(JSON.stringify(report, null, 2));
if (!dryRun && report.failed > 0) process.exitCode = 1;
if (verifyOnly && (migrated.length < expected || report.verified < expected)) process.exitCode = 1;
