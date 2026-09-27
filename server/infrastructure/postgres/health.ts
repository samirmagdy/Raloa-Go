import type { Pool } from 'pg';

export type PostgresHealth = { ok: boolean; latencyMs: number; error?: string };
export type PostgresReadiness = PostgresHealth & { schemaReady: boolean; latestMigration?: string };

export async function checkPostgresHealth(pool: Pool): Promise<PostgresHealth> {
  const startedAt = Date.now();
  try {
    await pool.query('SELECT 1');
    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return { ok: false, latencyMs: Date.now() - startedAt, error: error instanceof Error ? error.message : 'POSTGRES_HEALTH_CHECK_FAILED' };
  }
}

export async function checkPostgresReadiness(pool: Pool): Promise<PostgresReadiness> {
  const health = await checkPostgresHealth(pool);
  if (!health.ok) return { ...health, schemaReady: false };
  try {
    const result = await pool.query<{ version: string }>('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1');
    return { ...health, schemaReady: true, latestMigration: result.rows[0]?.version };
  } catch (error) {
    return { ...health, schemaReady: false, error: error instanceof Error ? error.message : 'POSTGRES_SCHEMA_NOT_READY' };
  }
}
