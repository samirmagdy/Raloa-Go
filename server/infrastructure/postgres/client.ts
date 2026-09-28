import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig, type PoolClient } from 'pg';
import * as schema from './schema';
import { assertPostgresRuntimeAllowed, readPostgresRuntimeConfig } from './config';
import type { ObservabilityMetrics } from '../observability/types';

export type PostgresDatabase = NodePgDatabase<typeof schema>;

export type PostgresLogger = {
  info?(event: string, fields?: Record<string, unknown>): void;
  warn?(event: string, fields?: Record<string, unknown>): void;
  error?(event: string, fields?: Record<string, unknown>): void;
};

export function createPostgresDatabase(config: PoolConfig | string = process.env.DATABASE_URL || '', logger?: PostgresLogger, metrics?: ObservabilityMetrics): { db: PostgresDatabase; pool: Pool } {
  if (!config) throw new Error('DATABASE_URL_NOT_CONFIGURED');
  const pool = new Pool(typeof config === 'string' ? { connectionString: config } : config);
  if (metrics) instrumentPostgresPool(pool, metrics);
  pool.on('connect', () => logger?.info?.('postgres.connection.opened'));
  pool.on('acquire', () => logger?.info?.('postgres.connection.acquired'));
  pool.on('release', () => logger?.info?.('postgres.connection.released'));
  pool.on('remove', () => logger?.info?.('postgres.connection.removed'));
  pool.on('error', (error) => logger?.error?.('postgres.pool.error', { error: error instanceof Error ? error.message : String(error) }));
  return { db: drizzle(pool, { schema }), pool };
}

/** Explicit opt-in constructor for local/dev tooling. Production remains on its existing datastore. */
export function createConfiguredPostgresDatabase(env: NodeJS.ProcessEnv = process.env, logger?: PostgresLogger, metrics?: ObservabilityMetrics): { db: PostgresDatabase; pool: Pool } {
  assertPostgresRuntimeAllowed(env);
  return createPostgresDatabase(readPostgresRuntimeConfig(env), logger, metrics);
}

function instrumentPostgresPool(pool: Pool, metrics: ObservabilityMetrics): void {
  const observePool = () => {
    if (!metrics.setGauge) return;
    const setGauge = metrics.setGauge.bind(metrics);
    const labels = { pool: 'application' };
    setGauge('postgres.pool.total', pool.totalCount, labels);
    setGauge('postgres.pool.idle', pool.idleCount, labels);
    setGauge('postgres.pool.waiting', pool.waitingCount, labels);
    setGauge('postgres.pool.max', Number((pool as Pool & { options?: { max?: number } }).options?.max || 0), labels);
  };
  const originalQuery = pool.query.bind(pool) as (...args: any[]) => any;
  (pool as any).query = (...args: any[]) => {
    observePool();
    const queryText = typeof args[0] === 'string' ? args[0] : args[0]?.text;
    const operation = String(queryText || 'unknown').trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '') || 'unknown';
    const startedAt = Date.now();
    const result = originalQuery(...args);
    if (result && typeof result.then === 'function') {
      result.then(() => metrics.observe('postgres.latency_ms', Date.now() - startedAt, { operation, status: 'success' }), (error: unknown) => {
        metrics.observe('postgres.latency_ms', Date.now() - startedAt, { operation, status: 'error' });
        metrics.increment('postgres.errors', { operation });
        void error;
      });
    }
    observePool();
    return result;
  };
  pool.on('acquire', observePool);
  pool.on('release', observePool);
  pool.on('remove', observePool);
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
