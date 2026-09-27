import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) { console.error('DATABASE_URL is required to verify PostgreSQL migrations.'); process.exit(2); }

const files = fs.readdirSync(path.resolve('db/migrations')).filter((file) => /^\d+_[a-z0-9_]+\.sql$/.test(file)).sort();
const expected = files.map((file) => ({
  version: file.split('_', 1)[0],
  checksum: crypto.createHash('sha256').update(fs.readFileSync(path.join('db/migrations', file))).digest('hex')
}));
const client = new pg.Client({ connectionString: databaseUrl, ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false } });
await client.connect();
try {
  const result = await client.query('SELECT version, checksum, applied_at FROM schema_migrations ORDER BY version');
  const applied = new Map(result.rows.map((row) => [row.version, row]));
  const missing = expected.filter(({ version }) => !applied.has(version)).map(({ version }) => version);
  const changed = expected.filter(({ version, checksum }) => applied.get(version)?.checksum !== checksum).map(({ version }) => version);
  const unknown = result.rows.filter(({ version }) => !expected.some((migration) => migration.version === version)).map(({ version }) => version);
  if (missing.length || changed.length || unknown.length) {
    console.error(JSON.stringify({ event: 'migration_verification_failed', missing, changed, unknown }));
    process.exit(1);
  }
  console.log(JSON.stringify({ event: 'migration_verification_succeeded', latestVersion: expected.at(-1)?.version ?? null, appliedAt: result.rows.at(-1)?.applied_at ?? null }));
} finally {
  await client.end();
}
