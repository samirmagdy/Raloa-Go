import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const databaseUrl = process.env.POSTGRES_DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) { console.error('DATABASE_URL is required to apply PostgreSQL migrations.'); process.exit(2); }
const environment = process.env.POSTGRES_ENVIRONMENT || (process.env.NODE_ENV === 'production' ? 'production' : process.env.NODE_ENV === 'test' ? 'test' : 'local');
if ((environment === 'staging' || environment === 'production') && process.env.POSTGRES_SSL !== 'true') { console.error('POSTGRES_SSL=true is required for staging/production migrations.'); process.exit(2); }
const { Client } = pg;
const postgresUrlSelected = Boolean(process.env.POSTGRES_DATABASE_URL);
const client = new Client({ connectionString: databaseUrl, ssl: process.env.POSTGRES_SSL === 'true' || (!postgresUrlSelected && process.env.DATABASE_SSL !== 'false') ? { rejectUnauthorized: false } : false });
const lockName = process.env.MIGRATION_LOCK_NAME || 'raloa:postgres:schema';
await client.connect();
let lockHeld = false;
try {
  const lockResult = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS acquired', [lockName]);
  lockHeld = lockResult.rows[0]?.acquired === true;
  if (!lockHeld) throw new Error(`Migration lock is held: ${lockName}`);
  console.log(JSON.stringify({ event: 'migration_lock_acquired', lockName }));
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  const directory = path.resolve('db/migrations');
  const files = fs.readdirSync(directory).filter((file) => /^\d+_[a-z0-9_]+\.sql$/.test(file)).sort();
  for (const file of files) {
    const version = file.split('_', 1)[0];
    const sql = fs.readFileSync(path.join(directory, file), 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');
    const existing = await client.query('SELECT checksum FROM schema_migrations WHERE version = $1', [version]);
    if (existing.rowCount) {
      if (existing.rows[0].checksum !== checksum) throw new Error(`Migration ${file} changed after it was applied.`);
      continue;
    }
    const startedAt = Date.now();
    console.log(JSON.stringify({ event: 'migration_started', file, version }));
    await client.query('BEGIN');
    try {
      // The file markers are checked for readability; the runner owns the
      // transaction so the migration ledger write is atomic too.
      const transactionalSql = sql.replace(/^\s*BEGIN;\s*/i, '').replace(/\s*COMMIT;\s*$/i, '');
      await client.query(transactionalSql);
      await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [version, checksum]);
      await client.query('COMMIT');
      console.log(JSON.stringify({ event: 'migration_succeeded', file, version, durationMs: Date.now() - startedAt }));
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(JSON.stringify({ event: 'migration_failed', file, version, error: error instanceof Error ? error.message : String(error) }));
      throw error;
    }
  }
} finally {
  if (lockHeld) await client.query('SELECT pg_advisory_unlock(hashtext($1))', [lockName]);
  await client.end();
}
