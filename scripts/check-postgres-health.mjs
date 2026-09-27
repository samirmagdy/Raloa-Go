import pg from 'pg';

const connectionString = process.env.POSTGRES_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error(JSON.stringify({ event: 'postgres_health_failed', error: 'POSTGRES_DATABASE_URL_NOT_CONFIGURED' }));
  process.exit(2);
}
const startedAt = Date.now();
const client = new pg.Client({ connectionString, ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED !== 'false' } : false });
try {
  await client.connect();
  await client.query('SELECT 1');
  const schema = await client.query('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1');
  console.log(JSON.stringify({ event: 'postgres_health_ok', schemaReady: true, latestMigration: schema.rows[0]?.version ?? null, latencyMs: Date.now() - startedAt }));
} catch (error) {
  console.error(JSON.stringify({ event: 'postgres_health_failed', latencyMs: Date.now() - startedAt, error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
