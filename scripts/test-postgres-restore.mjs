import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const sourceUrl = process.env.POSTGRES_RESTORE_SOURCE_URL || process.env.POSTGRES_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://raloa:raloa_local_only@127.0.0.1:5432/raloa_dev';
const source = new URL(sourceUrl);
const adminUrl = process.env.POSTGRES_RESTORE_ADMIN_URL || new URL('/postgres', source).toString();
const dockerContainer = process.env.POSTGRES_RESTORE_DOCKER_CONTAINER || '';
const restoreDatabase = `raloa_restore_${process.pid}_${Date.now()}`;
const target = new URL(adminUrl);
target.pathname = `/${restoreDatabase}`;
const admin = new URL(adminUrl);
admin.pathname = '/postgres';
const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'raloa-postgres-restore-'));
const dumpFile = path.join(tempDirectory, 'database.dump');

function connectionArgs(url) {
  return [url.toString()];
}

async function command(binary, args) {
  const executable = dockerContainer ? 'docker' : binary;
  const executableArgs = dockerContainer ? ['exec', dockerContainer, binary, ...args] : args;
  return run(executable, executableArgs, { maxBuffer: 32 * 1024 * 1024 });
}

function runtimeUrl(url) {
  if (!dockerContainer) return url.toString();
  const copy = new URL(url);
  if (copy.hostname === '127.0.0.1' || copy.hostname === 'localhost') copy.hostname = 'host.docker.internal';
  return copy.toString();
}

async function dumpSource() {
  if (!dockerContainer) {
    await command('pg_dump', ['--format=custom', '--no-owner', '--no-acl', '--file', dumpFile, source.toString()]);
    return;
  }
  const result = await run('docker', ['exec', dockerContainer, 'pg_dump', '--format=custom', '--no-owner', '--no-acl', runtimeUrl(source)], { encoding: 'buffer', maxBuffer: 128 * 1024 * 1024 });
  fs.writeFileSync(dumpFile, result.stdout, 'binary');
}

let databaseCreated = false;
try {
  console.log(JSON.stringify({ event: 'restore_test_started', sourceDatabase: source.pathname.slice(1), restoreDatabase }));
  await dumpSource();
  await command('psql', ['--dbname', runtimeUrl(admin), '--command', `CREATE DATABASE "${restoreDatabase}"`]);
  databaseCreated = true;
  const restoreFile = `/tmp/${path.basename(dumpFile)}`;
  if (dockerContainer) await run('docker', ['cp', dumpFile, `${dockerContainer}:${restoreFile}`], { maxBuffer: 1024 * 1024 });
  await command('pg_restore', ['--no-owner', '--no-acl', '--exit-on-error', '--single-transaction', '--dbname', runtimeUrl(target), dockerContainer ? restoreFile : dumpFile]);
  const check = await command('psql', ['--tuples-only', '--no-align', '--dbname', runtimeUrl(target), '--command', "SELECT (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public')::text || ':' || (SELECT count(*) FROM schema_migrations)::text"]);
  const [tableCount, migrationCount] = check.stdout.trim().split(':').map(Number);
  if (!Number.isFinite(tableCount) || tableCount < 1) throw new Error('RESTORE_NO_PUBLIC_TABLES');
  if (!Number.isFinite(migrationCount) || migrationCount < 1) throw new Error('RESTORE_NO_MIGRATION_LEDGER');
  console.log(JSON.stringify({ event: 'restore_test_passed', restoreDatabase, tableCount, migrationCount }));
} catch (error) {
  console.error(JSON.stringify({ event: 'restore_test_failed', restoreDatabase, error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
} finally {
  if (databaseCreated) {
    await command('psql', ['--dbname', runtimeUrl(admin), '--command', `DROP DATABASE IF EXISTS "${restoreDatabase}" WITH (FORCE)`]).catch((error) => {
      console.error(JSON.stringify({ event: 'restore_test_cleanup_failed', restoreDatabase, error: error instanceof Error ? error.message : String(error) }));
      process.exitCode = 1;
    });
  }
  fs.rmSync(tempDirectory, { recursive: true, force: true });
}
