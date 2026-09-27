import type { Pool } from 'pg';

export type PostgresHealth = { ok: boolean; latencyMs: number; error?: string };

export async function checkPostgresHealth(pool: Pool): Promise<PostgresHealth> {
  const startedAt = Date.now();
  try {
    await pool.query('SELECT 1');
    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return { ok: false, latencyMs: Date.now() - startedAt, error: error instanceof Error ? error.message : 'POSTGRES_HEALTH_CHECK_FAILED' };
  }
}
