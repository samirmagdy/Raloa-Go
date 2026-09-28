import { adminDb } from '../server-services';
import { createConfiguredPostgresDatabase } from '../server/infrastructure/postgres';

type Check = { domain: string; firestoreCount: number; postgresCount: number; rowCountMatch: boolean; ownershipChecked: boolean; semanticChecked: boolean; referentialIntegrityChecked: boolean; mismatches: string[] };

const env = process.env;
if (!adminDb) throw new Error('FIRESTORE_NOT_CONFIGURED');
const runtime = createConfiguredPostgresDatabase(env);

async function firestoreCount(collection: string): Promise<number> {
  const aggregate = await adminDb.collection(collection).count().get();
  return aggregate.data().count;
}

async function postgresCount(table: string): Promise<number> {
  const result = await runtime.pool.query(`SELECT count(*)::int AS count FROM ${table}`);
  return Number(result.rows[0]?.count || 0);
}

const mappings: Array<[string, string, string]> = [
  ['users', 'app_users', 'accounts/users'],
  ['bookings', 'bookings', 'bookings'],
  ['creator_products', 'products', 'products'],
  ['orders', 'orders', 'orders'],
  ['payments', 'payments', 'payments'],
  ['custom_domains', 'custom_domains', 'domains'],
  ['media_assets', 'media_assets', 'media'],
  ['audience_subscribers', 'audience_subscribers', 'audience subscribers'],
  ['audience_submissions', 'form_submissions', 'form submissions'],
  ['analytics_rollups', 'analytics_daily_rollups', 'analytics rollups'],
  ['outbox_events', 'outbox_events', 'outbox'],
  ['background_jobs', 'operational_jobs', 'jobs'],
  ['audit_log', 'audit_log', 'audit logs'],
  ['feature_flags', 'feature_flags', 'feature flags']
];

const checks: Check[] = [];
for (const [firestoreCollection, postgresTable, domain] of mappings) {
  const [sourceCount, targetCount] = await Promise.all([firestoreCount(firestoreCollection), postgresCount(postgresTable)]);
  checks.push({ domain, firestoreCount: sourceCount, postgresCount: targetCount, rowCountMatch: sourceCount === targetCount, ownershipChecked: false, semanticChecked: false, referentialIntegrityChecked: false, mismatches: sourceCount === targetCount ? [] : [`row count mismatch: Firestore ${sourceCount}, PostgreSQL ${targetCount}`] });
}

const integrity = await runtime.pool.query(`
  SELECT count(*)::int AS violations FROM (
    SELECT s.id FROM sites s LEFT JOIN app_users u ON u.id = s.owner_user_id WHERE u.id IS NULL
    UNION ALL
    SELECT b.id FROM bookings b LEFT JOIN sites s ON s.id = b.site_id WHERE s.id IS NULL
    UNION ALL
    SELECT o.id FROM orders o LEFT JOIN sites s ON s.id = o.site_id WHERE s.id IS NULL
  ) violations
`);
const referentialIntegrityPass = Number(integrity.rows[0]?.violations || 0) === 0;
for (const check of checks) check.referentialIntegrityChecked = referentialIntegrityPass;

const report = { generatedAt: new Date().toISOString(), status: checks.every((check) => check.rowCountMatch && check.referentialIntegrityChecked) ? 'passed' : 'blocked', checks, notes: ['Ownership and semantic equivalence require domain-specific legacy-ID and normalized-payload comparisons before approval.', 'This command is read-only and does not change either datastore.'] };
console.log(JSON.stringify(report, null, 2));
await runtime.pool.end();
if (report.status !== 'passed') process.exitCode = 1;

