import { createPostgresAuthDataSource } from '@raloa/database';
import { createPostgresDatabase } from '../../../../server/infrastructure/postgres/client';

let pool: ReturnType<typeof createPostgresDatabase>['pool'] | undefined;

export function getWebDatabase() {
  if (!process.env.POSTGRES_DATABASE_URL) throw new Error('POSTGRES_DATABASE_URL_NOT_CONFIGURED');
  pool ||= createPostgresDatabase({
    connectionString: process.env.POSTGRES_DATABASE_URL,
    max: Number(process.env.POSTGRES_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.POSTGRES_IDLE_TIMEOUT_MS || 30_000),
    connectionTimeoutMillis: Number(process.env.POSTGRES_CONNECTION_TIMEOUT_MS || 5_000),
    application_name: 'raloa-next-web',
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined,
  }).pool;
  return pool;
}

export function getWebAuthDataSource() {
  return createPostgresAuthDataSource(getWebDatabase());
}
