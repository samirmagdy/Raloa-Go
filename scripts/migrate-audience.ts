import 'dotenv/config';
import { adminDb } from '../server-services';
import { createConfiguredPostgresDatabase } from '../server/infrastructure/postgres';

type LegacyDocument = { id: string; data: Record<string, unknown> };

function asString(value: unknown): string { return typeof value === 'string' ? value : ''; }
function iso(value: unknown): string { return typeof value === 'string' ? value : new Date().toISOString(); }
function normalizeEmail(value: unknown): string { return asString(value).trim().toLowerCase(); }

async function loadAll(collection: string): Promise<LegacyDocument[]> {
  const snapshot = await adminDb.collection(collection).get();
  return snapshot.docs.map((document) => ({ id: document.id, data: document.data() as Record<string, unknown> }));
}

async function resolveSite(pool: import('pg').Pool, data: Record<string, unknown>) {
  const siteId = asString(data.siteId);
  const creatorUid = asString(data.creatorUserId || data.userId);
  const result = await pool.query<{ id: string; account_id: string }>(
    `SELECT s.id::text, s.account_id::text
       FROM sites s JOIN app_users u ON u.id = s.owner_user_id
      WHERE (s.id::text = $1 OR s.legacy_site_id = $1) AND u.external_auth_id = $2
      LIMIT 1`, [siteId, creatorUid]
  );
  return result.rows[0] || null;
}

async function main() {
  const { pool } = createConfiguredPostgresDatabase();
  const subscribers = await loadAll('audience_subscribers');
  const submissions = await loadAll('audience_submissions');
  let migratedSubscribers = 0; let migratedSubmissions = 0; let skipped = 0;
  try {
    await pool.query('BEGIN');
    for (const document of subscribers) {
      const site = await resolveSite(pool, document.data);
      const email = normalizeEmail(document.data.email);
      if (!site || !email) { skipped += 1; continue; }
      await pool.query(
        `INSERT INTO audience_subscribers (account_id, site_id, email, email_normalized, name, status, source, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $3, $4, $5, $6, $7::jsonb, $8, $9)
         ON CONFLICT (site_id, email_normalized) WHERE deleted_at IS NULL DO UPDATE SET updated_at = EXCLUDED.updated_at`,
        [site.account_id, site.id, email, asString(document.data.name || document.data.fullName) || null,
          document.data.status === 'unsubscribed' ? 'unsubscribed' : 'subscribed', asString(document.data.source) || 'legacy_firestore', JSON.stringify({ legacyId: document.id }), iso(document.data.createdAt), iso(document.data.updatedAt || document.data.createdAt)]
      );
      migratedSubscribers += 1;
    }
    for (const document of submissions) {
      const site = await resolveSite(pool, document.data);
      const email = normalizeEmail(document.data.email);
      if (!site) { skipped += 1; continue; }
      const payload = { fullName: asString(document.data.fullName || document.data.name), email, subject: asString(document.data.subject), message: asString(document.data.message) };
      await pool.query(
        `INSERT INTO form_submissions (account_id, site_id, form_key, submitter_email, payload, status, idempotency_key, retention_until, source, attribution, created_at, updated_at)
         VALUES ($1, $2, 'contact', $3, $4::jsonb, $5, $6, $7, 'legacy_firestore', $8::jsonb, $9, $10)
         ON CONFLICT (site_id, idempotency_key) DO UPDATE SET updated_at = EXCLUDED.updated_at`,
        [site.account_id, site.id, email || null, JSON.stringify(payload), document.data.status === 'read' ? 'processed' : document.data.status === 'archived' ? 'archived' : 'received', `legacy:${document.id}`, new Date(Date.now() + 2 * 365 * 86400000), JSON.stringify({ legacyId: document.id }), iso(document.data.createdAt), iso(document.data.updatedAt || document.data.createdAt)]
      );
      migratedSubmissions += 1;
    }
    await pool.query('COMMIT');
    const [subscriberCount, submissionCount] = await Promise.all([
      pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM audience_subscribers'),
      pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM form_submissions')
    ]);
    console.log(JSON.stringify({ migratedSubscribers, migratedSubmissions, skipped, postgresSubscribers: subscriberCount.rows[0]?.count, postgresSubmissions: submissionCount.rows[0]?.count }));
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  } finally {
    await pool.end();
  }
}

await main();
