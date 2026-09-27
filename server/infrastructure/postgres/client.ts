import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig, type PoolClient } from 'pg';
import * as schema from './schema';
import { assertPostgresRuntimeAllowed, readPostgresRuntimeConfig } from './config';

export type PostgresDatabase = NodePgDatabase<typeof schema>;

export type PostgresLogger = {
  info?(event: string, fields?: Record<string, unknown>): void;
  warn?(event: string, fields?: Record<string, unknown>): void;
  error?(event: string, fields?: Record<string, unknown>): void;
};

export function createPostgresDatabase(config: PoolConfig | string = process.env.DATABASE_URL || '', logger?: PostgresLogger): { db: PostgresDatabase; pool: Pool } {
  if (!config) throw new Error('DATABASE_URL_NOT_CONFIGURED');
  const pool = new Pool(typeof config === 'string' ? { connectionString: config } : config);
  pool.on('connect', () => logger?.info?.('postgres.connection.opened'));
  pool.on('acquire', () => logger?.info?.('postgres.connection.acquired'));
  pool.on('release', () => logger?.info?.('postgres.connection.released'));
  pool.on('remove', () => logger?.info?.('postgres.connection.removed'));
  pool.on('error', (error) => logger?.error?.('postgres.pool.error', { error: error instanceof Error ? error.message : String(error) }));
  return { db: drizzle(pool, { schema }), pool };
}

/** Explicit opt-in constructor for local/dev tooling. Production remains on its existing datastore. */
export function createConfiguredPostgresDatabase(env: NodeJS.ProcessEnv = process.env): { db: PostgresDatabase; pool: Pool } {
  assertPostgresRuntimeAllowed(env);
  return createPostgresDatabase(readPostgresRuntimeConfig(env));
}

export async function withPostgresTransaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>, logger?: PostgresLogger): Promise<T> {
  const client = await pool.connect();
  const startedAt = Date.now();
  try {
    await client.query('BEGIN');
    logger?.info?.('postgres.transaction.begin');
    const result = await work(client);
    await client.query('COMMIT');
    logger?.info?.('postgres.transaction.commit', { durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger?.warn?.('postgres.transaction.rollback', { durationMs: Date.now() - startedAt, error: error instanceof Error ? error.message : String(error) });
    throw error;
  } finally {
    client.release();
  }
}

export async function closePostgresDatabase(pool: Pool): Promise<void> {
  await pool.end();
}
