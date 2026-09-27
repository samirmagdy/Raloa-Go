import assert from 'node:assert/strict';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkPostgresReadiness, createIsolatedTestDatabase, withIsolatedTestTransaction } from '../../server/infrastructure/postgres/index.ts';

const configured = Boolean(process.env.POSTGRES_TEST_DATABASE_URL);
const suite = describe.skipIf(!configured);

suite('PostgreSQL integration foundation', () => {
  let database: ReturnType<typeof createIsolatedTestDatabase>;

  beforeAll(() => {
    database = createIsolatedTestDatabase();
    assert.ok(database, 'POSTGRES_TEST_DATABASE_URL must configure an isolated test database');
  });

  afterAll(async () => {
    await database?.pool.end();
  });

  it('reports connectivity and applied schema readiness', async () => {
    const readiness = await checkPostgresReadiness(database!.pool);
    expect(readiness.ok).toBe(true);
    expect(readiness.schemaReady).toBe(true);
    expect(readiness.latestMigration).toMatch(/^00[1-9]/);
  });

  it('supports transaction rollback isolation for test data', async () => {
    const marker = `postgres-test-${Date.now()}`;
    await withIsolatedTestTransaction(database!.pool, async (client) => {
      await client.query('INSERT INTO app_users (external_auth_id, email) VALUES ($1, $2)', [marker, `${marker}@example.test`]);
      const inserted = await client.query('SELECT external_auth_id FROM app_users WHERE external_auth_id = $1', [marker]);
      expect(inserted.rowCount).toBe(1);
    });
    const afterRollback = await database!.pool.query('SELECT external_auth_id FROM app_users WHERE external_auth_id = $1', [marker]);
    expect(afterRollback.rowCount).toBe(0);
  });
});

if (!configured) console.info('PostgreSQL integration suite skipped: set POSTGRES_TEST_DATABASE_URL to run against an isolated database.');

