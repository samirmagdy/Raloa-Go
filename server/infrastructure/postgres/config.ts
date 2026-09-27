import type { PoolConfig } from 'pg';

export type PostgresRuntimeConfig = PoolConfig & { connectionString: string };

export function readPostgresRuntimeConfig(env: NodeJS.ProcessEnv = process.env): PostgresRuntimeConfig {
  const connectionString = env.POSTGRES_DATABASE_URL || env.DATABASE_URL || '';
  if (!connectionString) throw new Error('POSTGRES_DATABASE_URL_NOT_CONFIGURED');
  const max = Number(env.POSTGRES_POOL_MAX || 10);
  if (!Number.isInteger(max) || max < 1 || max > 100) throw new Error('INVALID_POSTGRES_POOL_MAX');
  return {
    connectionString,
    max,
    min: Number(env.POSTGRES_POOL_MIN || 0),
    idleTimeoutMillis: Number(env.POSTGRES_IDLE_TIMEOUT_MS || 30_000),
    connectionTimeoutMillis: Number(env.POSTGRES_CONNECTION_TIMEOUT_MS || 5_000),
    ssl: env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: env.POSTGRES_SSL_REJECT_UNAUTHORIZED !== 'false' } : false,
    application_name: env.POSTGRES_APPLICATION_NAME || 'raloa-local'
  };
}

export function assertPostgresRuntimeAllowed(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV === 'production' && env.POSTGRES_ENABLED !== 'true') throw new Error('POSTGRES_NOT_ENABLED_FOR_PRODUCTION');
}
