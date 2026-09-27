import { Pool } from 'pg';
import { createPostgresAuthDataSource } from '@raloa/database';

let pool: Pool | undefined;

export function getWebDatabase() {
  if (!process.env.POSTGRES_DATABASE_URL) throw new Error('POSTGRES_DATABASE_URL_NOT_CONFIGURED');
  pool ||= new Pool({
    connectionString: process.env.POSTGRES_DATABASE_URL,
    max: Number(process.env.POSTGRES_POOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: 'raloa-next-web'
  });
  return pool;
}

export function getWebAuthDataSource() {
  return createPostgresAuthDataSource(getWebDatabase());
}
