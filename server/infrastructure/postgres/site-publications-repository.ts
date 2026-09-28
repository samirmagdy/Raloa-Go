import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { SitePublicationRepository, PublicationResult } from '../../domains/publishing/publication-service';

type ProfileLoader = (userId: string) => Promise<Record<string, any> | null>;

type SiteRow = {
  id: string;
  legacy_site_id: string | null;
  external_auth_id: string;
  account_id: string;
  owner_user_id: string;
  handle: string;
  display_name: string;
  content: Record<string, any>;
  is_published: boolean;
  draft_revision: number;
  publication_version: number;
  published_snapshot_id: string | null;
};
type PublicSiteRow = SiteRow & { snapshot_content: Record<string, any> };

function publicId(row: SiteRow): string { return row.legacy_site_id || row.id; }

function sitePayload(row: SiteRow, content: Record<string, any> = row.content): Record<string, any> {
  return {
    ...content,
    id: publicId(row),
    userId: row.external_auth_id,
    username: row.handle,
    displayName: row.display_name,
    isPublished: row.is_published,
    revision: Number(row.draft_revision || content.revision || 0),
    publicationVersion: Number(row.publication_version || 0)
  };
}

async function findSite(client: Pool | PoolClient, userId: string, siteId: string, lock = false): Promise<SiteRow | null> {
  const result = await client.query<SiteRow>(
    `SELECT s.*, u.external_auth_id
       FROM sites s JOIN app_users u ON u.id = s.owner_user_id
      WHERE u.external_auth_id = $1 AND (s.legacy_site_id = $2 OR s.id::text = $2)
      LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [userId, siteId]
  );
  return result.rows[0] || null;
}

async function writeAudit(client: PoolClient, input: { actorUserId: string; accountId: string; siteId: string; action: string; metadata: Record<string, unknown> }): Promise<void> {
  await client.query(
    `INSERT INTO audit_log (actor_user_id, actor_type, tenant_id, site_id, action, entity_type, entity_id, metadata)
     VALUES ($1, 'user', $2, $3, $4, 'site', $3, $5::jsonb)`,
    [input.actorUserId, input.accountId, input.siteId, input.action, JSON.stringify(input.metadata)]
  );
}

async function insertPublishedSnapshot(client: PoolClient, site: SiteRow, source: Record<string, any>, publicationVersion: number): Promise<string> {
  await client.query('UPDATE published_site_snapshots SET is_current = false WHERE site_id = $1 AND is_current', [site.id]);
  const draft = await client.query<{ id: string }>(
    `SELECT id FROM site_drafts WHERE site_id = $1 AND revision = $2 LIMIT 1`,
    [site.id, Number(site.draft_revision)]
  );
  const draftId = draft.rows[0]?.id || null;
  const contentHash = createHash('sha256').update(JSON.stringify(source)).digest('hex');
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO published_site_snapshots
       (account_id, site_id, draft_id, revision, publication_version, content, design_config, content_hash, published_by, is_current)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, true)
     RETURNING id`,
    [site.account_id, site.id, draftId, Number(site.draft_revision), publicationVersion, JSON.stringify(source), JSON.stringify(source.designTokens || {}), contentHash, site.owner_user_id]
  );
  return inserted.rows[0].id;
}

export function createPostgresSitePublicationRepository(pool: Pool): SitePublicationRepository {
  return {
    async publish({ userId, siteId, expectedDraftRevision }): Promise<PublicationResult> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const site = await findSite(client, userId, siteId, true);
        if (!site) { await client.query('ROLLBACK'); return { status: 'site_not_found' }; }
        if (expectedDraftRevision !== undefined && Number(site.draft_revision) !== expectedDraftRevision) {
          await client.query('ROLLBACK');
          return { status: 'version_conflict', site: sitePayload(site) };
        }
        const nextVersion = Number(site.publication_version || 0) + 1;
        const snapshotId = await insertPublishedSnapshot(client, site, site.content, nextVersion);
        await client.query(
          `UPDATE sites SET is_published = true, published_at = now(), publication_version = $1,
             published_snapshot_id = $2, updated_at = now() WHERE id = $3`,
          [nextVersion, snapshotId, site.id]
        );
        await client.query(
          `INSERT INTO outbox_events (event_type, event_version, aggregate_type, aggregate_id, idempotency_key, correlation_id, payload)
           VALUES ('SitePublished.v1', 1, 'site', $1, $2, $2, $3::jsonb) ON CONFLICT (idempotency_key) DO NOTHING`,
          [site.id, `site:${site.id}:publication:${nextVersion}`, JSON.stringify({ siteId: publicId(site), handle: site.handle, revision: Number(site.draft_revision), publicationVersion: nextVersion, snapshotId })]
        );
        await writeAudit(client, { actorUserId: site.owner_user_id, accountId: site.account_id, siteId: site.id, action: 'site.published', metadata: { publicationVersion: nextVersion, revision: Number(site.draft_revision), snapshotId } });
        await client.query('COMMIT');
        return { status: 'published', site: { ...sitePayload(site, site.content), isPublished: true, publicationVersion: nextVersion }, publicationVersion: nextVersion };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },

    async unpublish({ userId, siteId, expectedPublicationVersion }): Promise<PublicationResult> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const site = await findSite(client, userId, siteId, true);
        if (!site) { await client.query('ROLLBACK'); return { status: 'site_not_found' }; }
        if (expectedPublicationVersion !== undefined && Number(site.publication_version) !== expectedPublicationVersion) {
          await client.query('ROLLBACK');
          return { status: 'version_conflict', site: sitePayload(site) };
        }
        await client.query('UPDATE published_site_snapshots SET is_current = false WHERE site_id = $1 AND is_current', [site.id]);
        await client.query('UPDATE sites SET is_published = false, published_snapshot_id = NULL, updated_at = now() WHERE id = $1', [site.id]);
        await client.query(
          `INSERT INTO outbox_events (event_type, event_version, aggregate_type, aggregate_id, idempotency_key, correlation_id, payload)
           VALUES ('SiteUnpublished.v1', 1, 'site', $1, $2, $2, $3::jsonb) ON CONFLICT (idempotency_key) DO NOTHING`,
          [site.id, `site:${site.id}:unpublished:${site.publication_version}`, JSON.stringify({ siteId: publicId(site), handle: site.handle, publicationVersion: Number(site.publication_version) })]
        );
        await writeAudit(client, { actorUserId: site.owner_user_id, accountId: site.account_id, siteId: site.id, action: 'site.unpublished', metadata: { publicationVersion: Number(site.publication_version) } });
        await client.query('COMMIT');
        return { status: 'unpublished', site: { ...sitePayload(site), isPublished: false } };
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    },

    async rollback({ userId, siteId, publicationVersion, expectedPublicationVersion }): Promise<PublicationResult> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const site = await findSite(client, userId, siteId, true);
        if (!site) { await client.query('ROLLBACK'); return { status: 'site_not_found' }; }
        if (expectedPublicationVersion !== undefined && Number(site.publication_version) !== expectedPublicationVersion) {
          await client.query('ROLLBACK');
          return { status: 'version_conflict', site: sitePayload(site) };
        }
        const target = await client.query<Record<string, any>>(
          `SELECT * FROM published_site_snapshots WHERE site_id = $1 AND publication_version = $2 LIMIT 1`,
          [site.id, publicationVersion]
        );
        if (!target.rows[0]) { await client.query('ROLLBACK'); return { status: 'publication_not_found' }; }
        const nextVersion = Number(site.publication_version || 0) + 1;
        await client.query('UPDATE published_site_snapshots SET is_current = false WHERE site_id = $1 AND is_current', [site.id]);
        const clone = await client.query<{ id: string }>(
          `INSERT INTO published_site_snapshots
             (account_id, site_id, draft_id, revision, publication_version, content, design_config, content_hash, published_by, is_current)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true) RETURNING id`,
          [site.account_id, site.id, target.rows[0].draft_id, target.rows[0].revision, nextVersion, target.rows[0].content, target.rows[0].design_config, target.rows[0].content_hash, site.owner_user_id]
        );
        await client.query('UPDATE sites SET is_published = true, published_at = now(), publication_version = $1, published_snapshot_id = $2, updated_at = now() WHERE id = $3', [nextVersion, clone.rows[0].id, site.id]);
        await client.query(
          `INSERT INTO outbox_events (event_type, event_version, aggregate_type, aggregate_id, idempotency_key, correlation_id, payload)
           VALUES ('SitePublished.v1', 1, 'site', $1, $2, $2, $3::jsonb) ON CONFLICT (idempotency_key) DO NOTHING`,
          [site.id, `site:${site.id}:publication:${nextVersion}`, JSON.stringify({ siteId: publicId(site), handle: site.handle, revision: Number(target.rows[0].revision), publicationVersion: nextVersion, rollbackFromVersion: publicationVersion, snapshotId: clone.rows[0].id })]
        );
        await writeAudit(client, { actorUserId: site.owner_user_id, accountId: site.account_id, siteId: site.id, action: 'site.published', metadata: { publicationVersion: nextVersion, rollbackFromVersion: publicationVersion, snapshotId: clone.rows[0].id } });
        await client.query('COMMIT');
        return { status: 'rolled_back', site: { ...sitePayload(site, target.rows[0].content), isPublished: true, publicationVersion: nextVersion }, publicationVersion: nextVersion };
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    }
  };
}

export function createPostgresPublishedSiteReader(pool: Pool, options: { profileLoader?: ProfileLoader } = {}) {
  async function publicSite(row: SiteRow, content: Record<string, any>): Promise<Record<string, unknown> | null> {
    const profile = options.profileLoader ? await options.profileLoader(row.external_auth_id) : null;
    if (profile && profile.privacyPreferences?.profilePublished === false) return null;
    return { ...content, id: publicId(row), userId: row.external_auth_id, username: row.handle, handle: row.handle, isPublished: true, publicationVersion: Number(row.publication_version) };
  }
  return {
    async getPublishedSiteByHandle(handle: string): Promise<Record<string, unknown> | null> {
      const result = await pool.query<PublicSiteRow>(
        `SELECT s.*, u.external_auth_id, snap.content AS snapshot_content
           FROM sites s JOIN app_users u ON u.id = s.owner_user_id
           JOIN published_site_snapshots snap ON snap.id = s.published_snapshot_id AND snap.site_id = s.id
          WHERE s.handle = $1 AND s.is_published AND snap.is_current LIMIT 1`, [handle]
      );
      const row = result.rows[0];
      return row ? publicSite(row, row.snapshot_content) : null;
    },
    async getPublishedSiteById(userId: string, siteId: string): Promise<Record<string, unknown> | null> {
      const result = await pool.query<PublicSiteRow>(
        `SELECT s.*, u.external_auth_id, snap.content AS snapshot_content
           FROM sites s JOIN app_users u ON u.id = s.owner_user_id
           JOIN published_site_snapshots snap ON snap.id = s.published_snapshot_id AND snap.site_id = s.id
          WHERE u.external_auth_id = $1 AND (s.legacy_site_id = $2 OR s.id::text = $2) AND s.is_published AND snap.is_current LIMIT 1`, [userId, siteId]
      );
      const row = result.rows[0];
      return row ? publicSite(row, row.snapshot_content) : null;
    },
    async resolveSiteSlugRedirect(slug: string) {
      const result = await pool.query<{ old_handle: string; new_handle: string; legacy_site_id: string | null; external_auth_id: string }>(
        `SELECT r.old_handle, r.new_handle, s.legacy_site_id, u.external_auth_id
           FROM site_slug_redirects r JOIN sites s ON s.id = r.site_id JOIN app_users u ON u.id = s.owner_user_id
          WHERE r.old_handle = $1 LIMIT 1`, [slug]
      );
      const row = result.rows[0];
      return row ? { requestedSlug: row.old_handle, canonicalSlug: row.new_handle, siteId: row.legacy_site_id || '', userId: row.external_auth_id } : null;
    }
  };
}
