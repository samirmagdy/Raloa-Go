import type { PoolConfig } from 'pg';

export type PostgresRuntimeConfig = PoolConfig & { connectionString: string };

export type PostgresEnvironment = 'local' | 'test' | 'staging' | 'production';

function numberEnv(env: NodeJS.ProcessEnv, name: string, fallback: number, min: number, max: number): number {
  const value = Number(env[name] || fallback);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`INVALID_${name}`);
  return value;
}

function environmentOf(env: NodeJS.ProcessEnv): PostgresEnvironment {
  const value = env.POSTGRES_ENVIRONMENT || (env.NODE_ENV === 'production' ? 'production' : env.NODE_ENV === 'test' ? 'test' : 'local');
  if (value !== 'local' && value !== 'test' && value !== 'staging' && value !== 'production') throw new Error('INVALID_POSTGRES_ENVIRONMENT');
  return value;
}

export function readPostgresRuntimeConfig(env: NodeJS.ProcessEnv = process.env): PostgresRuntimeConfig {
  const connectionString = env.POSTGRES_DATABASE_URL || env.DATABASE_URL || '';
  if (!connectionString) throw new Error('POSTGRES_DATABASE_URL_NOT_CONFIGURED');
  let parsed: URL;
  try { parsed = new URL(connectionString); } catch { throw new Error('INVALID_POSTGRES_DATABASE_URL'); }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error('INVALID_POSTGRES_DATABASE_URL');
  const environment = environmentOf(env);
  const max = numberEnv(env, 'POSTGRES_POOL_MAX', environment === 'production' ? 10 : 5, 1, 100);
  const min = numberEnv(env, 'POSTGRES_POOL_MIN', 0, 0, max);
  const idleTimeoutMillis = numberEnv(env, 'POSTGRES_IDLE_TIMEOUT_MS', 30_000, 1_000, 300_000);
  const connectionTimeoutMillis = numberEnv(env, 'POSTGRES_CONNECTION_TIMEOUT_MS', 5_000, 500, 60_000);
  const sslEnabled = env.POSTGRES_SSL === 'true';
  if ((environment === 'staging' || environment === 'production') && !sslEnabled) throw new Error('POSTGRES_SSL_REQUIRED');
  return {
    connectionString,
    max,
    min,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    ssl: sslEnabled ? { rejectUnauthorized: env.POSTGRES_SSL_REJECT_UNAUTHORIZED !== 'false' } : false,
    application_name: env.POSTGRES_APPLICATION_NAME || `raloa-${environment}`,
  };
}

export function assertPostgresRuntimeAllowed(env: NodeJS.ProcessEnv = process.env): void {
  const environment = environmentOf(env);
  if (environment === 'production' && env.POSTGRES_ENABLED !== 'true') throw new Error('POSTGRES_NOT_ENABLED_FOR_PRODUCTION');
  if (environment === 'test' && env.POSTGRES_ENABLED === 'false') throw new Error('POSTGRES_DISABLED_FOR_TEST');
}
