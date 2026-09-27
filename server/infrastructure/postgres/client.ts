import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig, type PoolClient } from 'pg';
import * as schema from './schema';

export type PostgresDatabase = NodePgDatabase<typeof schema>;

export function createPostgresDatabase(config: PoolConfig | string = process.env.DATABASE_URL || ''): { db: PostgresDatabase; pool: Pool } {
  if (!config) throw new Error('DATABASE_URL_NOT_CONFIGURED');
  const pool = new Pool(typeof config === 'string' ? { connectionString: config } : config);
  return { db: drizzle(pool, { schema }), pool };
}

export async function withPostgresTransaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
