import { Pool, type PoolClient } from 'pg';
import { createPostgresDatabase, type PostgresLogger } from './client';
import { readPostgresRuntimeConfig } from './config';

export function readIsolatedTestDatabaseConfig(env: NodeJS.ProcessEnv = process.env) {
  const connectionString = env.POSTGRES_TEST_DATABASE_URL;
  if (!connectionString) return null;
  if (connectionString === env.POSTGRES_DATABASE_URL || connectionString === env.DATABASE_URL) {
    throw new Error('POSTGRES_TEST_DATABASE_MUST_BE_ISOLATED');
  }
  return readPostgresRuntimeConfig({
    ...env,
    POSTGRES_DATABASE_URL: connectionString,
    POSTGRES_ENVIRONMENT: 'test',
    POSTGRES_SSL: env.POSTGRES_TEST_SSL || env.POSTGRES_SSL || 'false',
    POSTGRES_POOL_MAX: env.POSTGRES_TEST_POOL_MAX || '2',
    POSTGRES_APPLICATION_NAME: env.POSTGRES_APPLICATION_NAME || 'raloa-test',
  });
}

export function createIsolatedTestDatabase(env: NodeJS.ProcessEnv = process.env, logger?: PostgresLogger): { db: ReturnType<typeof createPostgresDatabase>['db']; pool: Pool } | null {
  const config = readIsolatedTestDatabaseConfig(env);
  return config ? createPostgresDatabase(config, logger) : null;
}

export async function withIsolatedTestTransaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('ROLLBACK');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
