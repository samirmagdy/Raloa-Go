import assert from 'node:assert/strict';
import { createMediaDomainService } from './server/domains/media/media-service';
import type { MediaAsset } from './server/domains/media/contracts';

const assets = new Map<string, MediaAsset>();
const deleted: string[] = [];
const queued: string[] = [];
const service = createMediaDomainService({
  metadata: {
    async create(asset) { assets.set(asset.id, asset); },
    async get(id) { return assets.get(id) ?? null; },
    async listOwned(ownerUserId, siteId) { return [...assets.values()].filter((asset) => asset.ownerUserId === ownerUserId && asset.siteId === siteId); },
    async listAll() { return [...assets.values()]; },
    async listAbandoned() { return []; },
    async remove(id) { assets.delete(id); },
    async update(id, changes) { const next = { ...assets.get(id)!, ...changes }; assets.set(id, next); return next; }
  },
  storage: {
    provider: 'cloudflare_r2',
    async put(input) { return { provider: 'cloudflare_r2', objectKey: input.objectKey, contentType: input.contentType, bytes: input.bytes.byteLength, cdnUrl: `https://cdn.test/${input.objectKey}` }; },
    async delete(objectKey) { deleted.push(objectKey); },
    async listKeys() { return []; },
    getCdnUrl: (objectKey) => `https://cdn.test/${objectKey}`,
    async createUploadUrl(input) { return { url: `https://upload.test/${input.objectKey}`, expiresAt: '2026-01-01T00:15:00.000Z', headers: { 'Content-Type': input.contentType } }; }
  },
  processing: { async enqueue(input) { queued.push(input.idempotencyKey); } },
  clock: () => '2026-01-01T00:00:00.000Z'
});

await service.beginUpload({ id: 'asset-1', ownerUserId: 'user-1', siteId: 'site-1', purpose: 'gallery', contentType: 'image/webp' });
const upload = await service.createUploadUrl({ assetId: 'asset-1', ownerUserId: 'user-1' });
assert.equal(upload.objectKey, 'sites/site-1/media/asset-1/original');
await assert.rejects(() => service.createUploadUrl({ assetId: 'asset-1', ownerUserId: 'other-user' }), /MEDIA_NOT_FOUND/);
const completed = await service.completeUpload({ assetId: 'asset-1', ownerUserId: 'user-1', bytes: new Uint8Array([1, 2, 3]), checksum: 'sha256:test' });
assert.equal(completed.lifecycle, 'processing');
assert.equal(completed.original.provider, 'cloudflare_r2');
assert.deepEqual(queued, ['media-processing:asset-1']);
await assert.rejects(() => service.completeUpload({ assetId: 'asset-1', ownerUserId: 'other-user', bytes: new Uint8Array() }));
await service.remove({ assetId: 'asset-1', ownerUserId: 'user-1' });
assert.equal(assets.get('asset-1')?.lifecycle, 'deleted');
assert.equal(deleted.length, 1);
console.log('Media service tests passed');
