import 'dotenv/config';
import { adminDb } from '../server-services';
import { createConfiguredPostgresDatabase } from '../server/infrastructure/postgres';
import { normalizeSiteProjection } from '../server/domains/sites/migration';
import { normalizeSiteContent, validateSiteContent } from '../src/shared/schemas';

const runtime = createConfiguredPostgresDatabase();
const pool = runtime.pool;
const report = { users: 0, sites: 0, drafts: 0, snapshots: 0, conflicts: [] as Array<Record<string, unknown>> };

try {
  const users = await adminDb.collection('users').get();
  for (const userDocument of users.docs) {
    const userId = userDocument.id;
    const userData = userDocument.data() || {};
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const appUser = await client.query<{ id: string }>(
        `INSERT INTO app_users (external_auth_id, email, display_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (external_auth_id) DO UPDATE SET email = EXCLUDED.email, display_name = EXCLUDED.display_name, updated_at = now()
         RETURNING id`,
        [userId, typeof userData.email === 'string' ? userData.email : null, typeof userData.displayName === 'string' ? userData.displayName : null]
      );
      const appUserId = appUser.rows[0].id;
      const account = await client.query<{ id: string }>(
        `INSERT INTO accounts (primary_user_id, name) VALUES ($1, $2)
         ON CONFLICT (primary_user_id, name) DO UPDATE SET updated_at = now()
         RETURNING id`,
        [appUserId, typeof userData.displayName === 'string' && userData.displayName.trim() ? userData.displayName.trim() : `Account ${userId}`]
      );
      const accountId = account.rows[0].id;
      await client.query(
        `INSERT INTO account_memberships (account_id, user_id, role) VALUES ($1, $2, 'owner')
         ON CONFLICT (account_id, user_id) DO UPDATE SET role = 'owner', updated_at = now()`,
        [accountId, appUserId]
      );
      await client.query('COMMIT');
      report.users += 1;

      const siteDocuments = await userDocument.ref.collection('sites').get();
      for (const siteDocument of siteDocuments.docs) {
        const raw = siteDocument.data() || {};
        const normalizedContent = normalizeSiteContent(raw);
        const validation = validateSiteContent(normalizedContent);
        if (!validation.valid) {
          report.conflicts.push({ userId, siteId: siteDocument.id, reason: 'INVALID_SITE_CONTENT', errors: validation.issues });
          continue;
        }
        const projection = normalizeSiteProjection({ id: siteDocument.id, ...normalizedContent });
        if (!projection.legacySiteId || !projection.handle) {
          report.conflicts.push({ userId, siteId: siteDocument.id, reason: 'MISSING_SITE_ID_OR_HANDLE' });
          continue;
        }
        const siteClient = await pool.connect();
        try {
          await siteClient.query('BEGIN');
          const collision = await siteClient.query<{ legacy_site_id: string | null }>(
            'SELECT legacy_site_id FROM sites WHERE handle = $1 AND legacy_site_id <> $2 LIMIT 1',
            [projection.handle, projection.legacySiteId]
          );
          if (collision.rowCount) {
            report.conflicts.push({ userId, siteId: siteDocument.id, handle: projection.handle, reason: 'HANDLE_COLLISION', existingSiteId: collision.rows[0].legacy_site_id });
            await siteClient.query('ROLLBACK');
            continue;
          }
          const siteResult = await siteClient.query<{ id: string }>(
            `INSERT INTO sites (owner_user_id, account_id, legacy_site_id, handle, display_name, content, is_published, published_at)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, CASE WHEN $7 THEN now() ELSE NULL END)
             ON CONFLICT (legacy_site_id) DO UPDATE SET handle = EXCLUDED.handle, display_name = EXCLUDED.display_name, content = EXCLUDED.content, is_published = EXCLUDED.is_published, published_at = EXCLUDED.published_at, updated_at = now()
             RETURNING id`,
            [appUserId, accountId, projection.legacySiteId, projection.handle, String(raw.displayName || projection.handle), JSON.stringify(normalizedContent), projection.isPublished]
          );
          const siteId = siteResult.rows[0].id;
          const draft = await siteClient.query<{ id: string }>(
            `INSERT INTO site_drafts (account_id, site_id, revision, content, design_config, created_by)
             VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)
             ON CONFLICT (site_id, revision) DO UPDATE SET content = EXCLUDED.content, design_config = EXCLUDED.design_config, updated_at = now()
             RETURNING id`,
            [accountId, siteId, projection.revision || 1, JSON.stringify(normalizedContent), JSON.stringify(normalizedContent.designTokens || {}), appUserId]
          );
          report.drafts += 1;
          if (projection.isPublished) {
            await siteClient.query('UPDATE published_site_snapshots SET is_current = false WHERE site_id = $1 AND is_current', [siteId]);
            await siteClient.query(
              `INSERT INTO published_site_snapshots (account_id, site_id, draft_id, revision, content, design_config, content_hash, published_by)
               VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)
               ON CONFLICT (site_id, revision) DO NOTHING`,
              [accountId, siteId, draft.rows[0].id, projection.revision || 1, JSON.stringify(normalizedContent), JSON.stringify(normalizedContent.designTokens || {}), projection.contentHash, appUserId]
            );
            report.snapshots += 1;
          }
          await siteClient.query('COMMIT');
          report.sites += 1;
        } catch (error) {
          await siteClient.query('ROLLBACK');
          report.conflicts.push({ userId, siteId: siteDocument.id, reason: 'WRITE_FAILED', error: error instanceof Error ? error.message : String(error) });
        } finally {
          siteClient.release();
        }
      }
    } catch (error) {
      await client.query('ROLLBACK');
      report.conflicts.push({ userId, reason: 'USER_WRITE_FAILED', error: error instanceof Error ? error.message : String(error) });
    } finally {
      client.release();
    }
  }
  console.log(JSON.stringify({ event: 'sites_migration_completed', ...report }));
  if (report.conflicts.length) process.exitCode = 1;
} finally {
  await pool.end();
}
