import type { Pool } from 'pg';
import type { MediaAsset, MediaMetadataRepository, MediaObject } from '../../domains/media/contracts';

type AssetRow = { id: string; owner_user_id: string; owner_external_auth_id: string; site_id: string; purpose: MediaAsset['purpose']; lifecycle_state: MediaAsset['lifecycle']; original_provider: MediaObject['provider']; original_object_key: string; original_content_type: string; original_bytes: number; original_checksum: string | null; width: number | null; height: number | null; alt_text: string | null; created_at: Date | string; updated_at: Date | string; deleted_at: Date | string | null };
type VariantRow = { asset_id: string; kind: 'processed' | 'thumbnail'; provider: MediaObject['provider']; object_key: string; content_type: string; bytes: number; checksum: string | null; cdn_url: string | null };

const iso = (value: Date | string) => new Date(value).toISOString();

function toAsset(row: AssetRow, variants: VariantRow[] = []): MediaAsset {
  const object = { provider: row.original_provider, objectKey: row.original_object_key, contentType: row.original_content_type, bytes: Number(row.original_bytes), ...(row.original_checksum ? { checksum: row.original_checksum } : {}) } as MediaObject;
  const variant = (kind: VariantRow['kind']) => variants.find((item) => item.kind === kind);
  const toObject = (item: VariantRow | undefined): MediaObject | undefined => item ? { provider: item.provider, objectKey: item.object_key, contentType: item.content_type, bytes: Number(item.bytes), checksum: item.checksum || undefined, cdnUrl: item.cdn_url || undefined } : undefined;
  return { id: row.id, ownerUserId: row.owner_external_auth_id, siteId: row.site_id, purpose: row.purpose, lifecycle: row.lifecycle_state, original: object, processed: toObject(variant('processed')), thumbnail: toObject(variant('thumbnail')), width: row.width || undefined, height: row.height || undefined, altText: row.alt_text || undefined, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), deletedAt: row.deleted_at ? iso(row.deleted_at) : undefined };
}

export function createPostgresMediaMetadataRepository(pool: Pool, options: { publicBaseUrl?: string } = {}): MediaMetadataRepository {
  const withCdn = (object: MediaObject | undefined) => object && !object.cdnUrl && options.publicBaseUrl ? { ...object, cdnUrl: `${options.publicBaseUrl.replace(/\/$/, '')}/${object.objectKey}` } : object;
  async function variantsFor(assetIds: string[]): Promise<Map<string, VariantRow[]>> {
    if (!assetIds.length) return new Map();
    const result = await pool.query<VariantRow>('SELECT * FROM media_variants WHERE asset_id = ANY($1::uuid[]) ORDER BY asset_id, kind', [assetIds]);
    const grouped = new Map<string, VariantRow[]>();
    for (const row of result.rows) grouped.set(row.asset_id, [...(grouped.get(row.asset_id) || []), row]);
    return grouped;
  }
  async function read(id: string): Promise<MediaAsset | null> {
    const asset = await pool.query<AssetRow>(`SELECT m.*, u.external_auth_id AS owner_external_auth_id FROM media_assets m JOIN app_users u ON u.id = m.owner_user_id WHERE m.id = $1`, [id]);
    if (!asset.rows[0]) return null;
    const variants = await pool.query<VariantRow>('SELECT * FROM media_variants WHERE asset_id = $1', [id]);
    const result = toAsset(asset.rows[0], variants.rows);
    return { ...result, original: withCdn(result.original)!, processed: withCdn(result.processed), thumbnail: withCdn(result.thumbnail) };
  }
  return {
    async create(asset) {
      await pool.query(`INSERT INTO media_assets (id, owner_user_id, site_id, purpose, lifecycle_state, original_provider, original_object_key, original_content_type, original_bytes, original_checksum, width, height, alt_text, created_at, updated_at) SELECT $1, u.id, s.id, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15 FROM app_users u JOIN sites s ON s.owner_user_id = u.id WHERE u.external_auth_id = $2 AND (s.id::text = $3 OR s.legacy_site_id = $3)`, [asset.id, asset.ownerUserId, asset.siteId, asset.purpose, asset.lifecycle, asset.original.provider, asset.original.objectKey, asset.original.contentType, asset.original.bytes, asset.original.checksum || null, asset.width || null, asset.height || null, asset.altText || null, asset.createdAt]);
      const created = await read(asset.id); if (!created) throw new Error('MEDIA_OWNER_NOT_FOUND');
    },
    async get(id) { const asset = await read(id); return asset?.lifecycle === 'deleted' ? null : asset; },
    async listOwned(ownerUserId, siteId) {
      const result = await pool.query<AssetRow>(`SELECT m.*, u.external_auth_id AS owner_external_auth_id FROM media_assets m JOIN app_users u ON u.id = m.owner_user_id JOIN sites s ON s.id = m.site_id WHERE u.external_auth_id = $1 AND (s.id::text = $2 OR s.legacy_site_id = $2) AND m.lifecycle_state = 'ready' ORDER BY m.created_at DESC LIMIT 500`, [ownerUserId, siteId]);
      const variants = await variantsFor(result.rows.map((row) => row.id));
      const assets = result.rows.map((row) => toAsset(row, variants.get(row.id) || []));
      return assets.map((asset) => ({ ...asset, original: withCdn(asset.original)!, processed: withCdn(asset.processed), thumbnail: withCdn(asset.thumbnail) }));
    },
    async listAll(ownerUserId, siteId) { const values: unknown[] = []; const filters = ["m.lifecycle_state <> 'deleted'"]; if (ownerUserId) { values.push(ownerUserId); filters.push(`u.external_auth_id = $${values.length}`); } if (siteId) { values.push(siteId); filters.push(`(s.id::text = $${values.length} OR s.legacy_site_id = $${values.length})`); } const result = await pool.query<AssetRow>(`SELECT m.*, u.external_auth_id AS owner_external_auth_id FROM media_assets m JOIN app_users u ON u.id = m.owner_user_id JOIN sites s ON s.id = m.site_id WHERE ${filters.join(' AND ')} ORDER BY m.created_at DESC, m.id DESC LIMIT 10000`, values); const variants = await variantsFor(result.rows.map((row) => row.id)); return result.rows.map((row) => toAsset(row, variants.get(row.id) || [])); },
    async listAbandoned(cutoff, ownerUserId, siteId) { const values: unknown[] = [cutoff]; const filters = ["m.lifecycle_state IN ('pending_upload', 'uploaded', 'processing')", 'm.created_at < $1']; if (ownerUserId) { values.push(ownerUserId); filters.push(`u.external_auth_id = $${values.length}`); } if (siteId) { values.push(siteId); filters.push(`(s.id::text = $${values.length} OR s.legacy_site_id = $${values.length})`); } const result = await pool.query<AssetRow>(`SELECT m.*, u.external_auth_id AS owner_external_auth_id FROM media_assets m JOIN app_users u ON u.id = m.owner_user_id JOIN sites s ON s.id = m.site_id WHERE ${filters.join(' AND ')} LIMIT 500`, values); return result.rows.map((row) => toAsset(row)); },
    async remove(id) { await pool.query('DELETE FROM media_assets WHERE id = $1', [id]); },
    async update(id, changes) {
      const current = await read(id); if (!current) throw new Error('MEDIA_NOT_FOUND');
      const original = changes.original || current.original;
      await pool.query(`UPDATE media_assets SET lifecycle_state = $2, original_provider = $3, original_object_key = $4, original_content_type = $5, original_bytes = $6, original_checksum = $7, width = $8, height = $9, alt_text = $10, deleted_at = $11, updated_at = $12 WHERE id = $1`, [id, changes.lifecycle || current.lifecycle, original.provider, original.objectKey, original.contentType, original.bytes, original.checksum || null, changes.width ?? current.width ?? null, changes.height ?? current.height ?? null, changes.altText ?? current.altText ?? null, changes.deletedAt || current.deletedAt || null, changes.updatedAt || new Date().toISOString()]);
      for (const kind of ['processed', 'thumbnail'] as const) { const variant = changes[kind] || current[kind]; if (variant) await pool.query(`INSERT INTO media_variants (asset_id, kind, provider, object_key, content_type, bytes, checksum, cdn_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (asset_id, kind) DO UPDATE SET provider = EXCLUDED.provider, object_key = EXCLUDED.object_key, content_type = EXCLUDED.content_type, bytes = EXCLUDED.bytes, checksum = EXCLUDED.checksum, cdn_url = EXCLUDED.cdn_url, updated_at = now()`, [id, kind, variant.provider, variant.objectKey, variant.contentType, variant.bytes, variant.checksum || null, variant.cdnUrl || null]); }
      return (await read(id))!;
    }
  };
}
