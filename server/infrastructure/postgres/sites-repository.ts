import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { SitePersistenceRepository } from '../../repositories/site-persistence';

type SiteValue = Record<string, any>;
type ProfileLoader = (userId: string) => Promise<SiteValue | null>;

type SiteRow = {
  id: string;
  legacy_site_id: string | null;
  external_auth_id: string;
  account_id: string;
  handle: string;
  display_name: string;
  content: SiteValue;
  is_published: boolean;
  updated_at: Date | string;
  owner_user_id: string;
};

function publicSiteId(row: SiteRow): string {
  return row.legacy_site_id || row.id;
}

function toIso(value: Date | string | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

function toLegacySite(row: SiteRow): SiteValue {
  const content = row.content && typeof row.content === 'object' ? row.content : {};
  return {
    ...content,
    id: publicSiteId(row),
    userId: row.external_auth_id,
    username: row.handle,
    displayName: row.display_name,
    isPublished: row.is_published,
    updatedAt: toIso(row.updated_at),
    revision: Number(content.revision || 0),
  };
}

async function ownerFor(client: Pool | PoolClient, userId: string) {
  const result = await client.query<{ user_id: string; account_id: string }>(
    `SELECT u.id AS user_id, a.id AS account_id
       FROM app_users u
       JOIN accounts a ON a.primary_user_id = u.id
      WHERE u.external_auth_id = $1
      LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function siteRow(client: Pool | PoolClient, userId: string, siteId: string, lock = false): Promise<SiteRow | null> {
  const result = await client.query<SiteRow>(
    `SELECT s.*, u.external_auth_id
       FROM sites s
       JOIN app_users u ON u.id = s.owner_user_id
      WHERE u.external_auth_id = $1
        AND (s.legacy_site_id = $2 OR s.id::text = $2)
      LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [userId, siteId]
  );
  return result.rows[0] || null;
}

async function writeDraftAndSnapshot(client: PoolClient, row: SiteRow, site: SiteValue, userId: string, publish: boolean): Promise<void> {
  const revision = Number(site.revision || 0);
  const draftResult = await client.query<{ id: string }>(
    `INSERT INTO site_drafts (account_id, site_id, revision, content, design_config, created_by)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)
     RETURNING id`,
    [row.account_id, row.id, revision, JSON.stringify(site), JSON.stringify(site.designTokens || {}), row.owner_user_id]
  );
  const draftId = draftResult.rows[0].id;
  const links = Array.isArray(site.links) ? site.links : [];
  for (let position = 0; position < links.length; position += 1) {
    const link = links[position];
    const blockKey = typeof link?.id === 'string' && link.id ? link.id : `link-${position}`;
    await client.query(
      `INSERT INTO site_blocks (account_id, site_id, draft_id, block_key, block_type, position, config)
       VALUES ($1, $2, $3, $4, 'link', $5, $6::jsonb)`,
      [row.account_id, row.id, draftId, blockKey, position, JSON.stringify(link || {})]
    );
  }
  if (!publish) return;

  await client.query('UPDATE published_site_snapshots SET is_current = false WHERE site_id = $1 AND is_current = true', [row.id]);
  const contentHash = createHash('sha256').update(JSON.stringify(site)).digest('hex');
  const snapshotResult = await client.query<{ id: string }>(
    `INSERT INTO published_site_snapshots (account_id, site_id, draft_id, revision, content, design_config, content_hash, published_by)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)
     RETURNING id`,
    [row.account_id, row.id, draftId, revision, JSON.stringify(site), JSON.stringify(site.designTokens || {}), contentHash, row.owner_user_id]
  );
  const snapshotId = snapshotResult.rows[0].id;
  await client.query(
    `INSERT INTO site_blocks (account_id, site_id, snapshot_id, block_key, block_type, position, config)
     SELECT account_id, site_id, $1, block_key, block_type, position, config
       FROM site_blocks WHERE draft_id = $2`,
    [snapshotId, draftId]
  );
}

function translateDatabaseError(error: unknown): never {
  if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === '23505') throw new Error('HANDLE_IN_USE');
  throw error;
}

export function createPostgresSitePersistenceRepository(pool: Pool, options: { profileLoader?: ProfileLoader } = {}): SitePersistenceRepository {
  return {
    async listOwned(userId, limit = 100) {
      const result = await pool.query<SiteRow>(
        `SELECT s.*, u.external_auth_id
           FROM sites s JOIN app_users u ON u.id = s.owner_user_id
          WHERE u.external_auth_id = $1
          ORDER BY s.updated_at DESC LIMIT $2`,
        [userId, Math.min(Math.max(limit, 1), 100)]
      );
      return result.rows.map((row) => ({ id: publicSiteId(row), data: toLegacySite(row) }));
    },

    async getProfile(userId) {
      if (options.profileLoader) return options.profileLoader(userId);
      const result = await pool.query<{ external_auth_id: string; email: string | null; display_name: string | null }>(
        'SELECT external_auth_id, email, display_name FROM app_users WHERE external_auth_id = $1 LIMIT 1',
        [userId]
      );
      const row = result.rows[0];
      return row ? { id: row.external_auth_id, email: row.email, displayName: row.display_name, plan: 'free' } : null;
    },

    async getOwned(userId, siteId) {
      const row = await siteRow(pool, userId, siteId);
      return row ? { id: publicSiteId(row), data: toLegacySite(row) } : null;
    },

    async isHandleTaken(handle, userId, siteId) {
      const result = await pool.query(
        `SELECT 1 FROM sites WHERE handle = $1 AND ($2 = '' OR legacy_site_id <> $2)
         UNION ALL SELECT 1 FROM site_slug_redirects WHERE old_handle = $1 LIMIT 1`,
        [handle, siteId || '']
      );
      return (result.rowCount ?? 0) > 0;
    },

    async create(userId, siteId, site) {
      const owner = await ownerFor(pool, userId);
      if (!owner) throw new Error('SITE_OWNER_NOT_MIGRATED');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const inserted = await client.query<SiteRow>(
          `INSERT INTO sites (owner_user_id, account_id, legacy_site_id, handle, display_name, content, is_published)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, false)
           RETURNING *`,
          [owner.user_id, owner.account_id, siteId, String(site.username || ''), String(site.displayName || ''), JSON.stringify(site)]
        );
        await writeDraftAndSnapshot(client, { ...inserted.rows[0], external_auth_id: userId }, site, userId, false);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        translateDatabaseError(error);
      } finally {
        client.release();
      }
    },

    async delete(userId, siteId) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const row = await siteRow(client, userId, siteId, true);
        if (!row) { await client.query('ROLLBACK'); return { site: {}, deleted: false }; }
        await client.query('DELETE FROM site_slug_redirects WHERE site_id = $1', [row.id]);
        await client.query('DELETE FROM sites WHERE id = $1', [row.id]);
        await client.query('COMMIT');
        return { site: toLegacySite(row), deleted: true };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async saveVersioned({ userId, siteId, site, previousHandle, nextHandle, expectedRevision }) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const current = await siteRow(client, userId, siteId, true);
        if (!current) { await client.query('ROLLBACK'); return { status: 'site_not_found' as const }; }
        const currentSite = toLegacySite(current);
        const currentRevision = Number(currentSite.revision || 0);
        if (expectedRevision !== undefined && currentRevision !== expectedRevision) {
          await client.query('ROLLBACK');
          return { status: 'version_conflict' as const, site: currentSite };
        }
        if (previousHandle && previousHandle !== nextHandle) {
          const redirect = await client.query('SELECT site_id FROM site_slug_redirects WHERE old_handle = $1 FOR UPDATE', [previousHandle]);
          if (redirect.rowCount && redirect.rows[0].site_id !== current.id) {
            await client.query('ROLLBACK');
            return { status: 'handle_redirect_conflict' as const };
          }
          await client.query(
            `INSERT INTO site_slug_redirects (account_id, site_id, old_handle, new_handle, created_by)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (old_handle) DO UPDATE SET new_handle = EXCLUDED.new_handle, updated_at = now()`,
            [current.account_id, current.id, previousHandle, nextHandle, current.owner_user_id]
          );
        }
        const updatedSite: SiteValue = { ...site, revision: currentRevision + 1 };
        await client.query(
          `UPDATE sites SET handle = $1, display_name = $2, content = $3::jsonb, is_published = $4, updated_at = now()
             WHERE id = $5 AND owner_user_id = $6`,
          [nextHandle, String(updatedSite.displayName || ''), JSON.stringify(updatedSite), updatedSite.isPublished === true, current.id, current.owner_user_id]
        );
        const updatedRow = { ...current, handle: nextHandle, display_name: String(updatedSite.displayName || ''), content: updatedSite, is_published: updatedSite.isPublished === true, updated_at: new Date() };
        await writeDraftAndSnapshot(client, updatedRow, updatedSite, userId, updatedSite.isPublished === true);
        await client.query('COMMIT');
        return { status: 'saved' as const, site: updatedSite };
      } catch (error) {
        await client.query('ROLLBACK');
        if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === '23505') return { status: 'handle_redirect_conflict' as const };
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
