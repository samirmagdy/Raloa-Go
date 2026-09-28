import type { Pool } from 'pg';
import type { OAuthConnection, OAuthConnectionRepository } from '../../domains/integrations/oauth-service';

type OAuthRow = {
  id: string;
  external_auth_id: string;
  site_id: string | null;
  provider: string;
  scopes: string[];
  connection_state: OAuthConnection['state'];
  encrypted_access_token: string | null;
  encrypted_refresh_token: string | null;
  access_token_expires_at: Date | null;
  refresh_lock_until: Date | null;
  token_version: number;
  updated_at: Date;
};

function map(row: OAuthRow): OAuthConnection {
  if (!row.encrypted_access_token) throw new Error('OAUTH_TOKEN_NOT_PERSISTED');
  return {
    id: row.id,
    userId: row.external_auth_id,
    siteId: row.site_id || undefined,
    provider: row.provider,
    scopes: row.scopes || [],
    state: row.connection_state,
    encryptedAccessToken: row.encrypted_access_token,
    encryptedRefreshToken: row.encrypted_refresh_token || undefined,
    expiresAt: row.access_token_expires_at?.getTime(),
    refreshLockUntil: row.refresh_lock_until?.getTime(),
    tokenVersion: Number(row.token_version),
    updatedAt: row.updated_at.toISOString()
  };
}

/** PostgreSQL OAuth metadata repository. Token values remain encrypted envelopes. */
export function createPostgresOAuthRepository(pool: Pool): OAuthConnectionRepository {
  async function accountAndSite(userId: string, siteId?: string) {
    const result = await pool.query<{ account_id: string; site_id: string | null }>(
      `SELECT a.id::text AS account_id, s.id::text AS site_id
         FROM app_users u
         JOIN accounts a ON a.primary_user_id = u.id
         LEFT JOIN sites s ON s.account_id = a.id
          AND ($2::text IS NULL OR s.id::text = $2 OR s.legacy_site_id = $2)
        WHERE u.external_auth_id = $1
        ORDER BY s.id NULLS LAST
        LIMIT 1`, [userId, siteId || null]
    );
    return result.rows[0] || null;
  }

  return {
    async get(userId, provider, siteId) {
      const result = await pool.query<OAuthRow>(
        `SELECT c.id, u.external_auth_id, c.site_id::text, c.provider, c.scopes, c.connection_state,
                convert_from(c.encrypted_access_token, 'utf8') AS encrypted_access_token,
                CASE WHEN c.encrypted_refresh_token IS NULL THEN NULL ELSE convert_from(c.encrypted_refresh_token, 'utf8') END AS encrypted_refresh_token,
                c.access_token_expires_at, c.refresh_lock_until, c.token_version, c.updated_at
           FROM oauth_connections c
           JOIN accounts a ON a.id = c.account_id
           JOIN app_users u ON u.id = a.primary_user_id
          WHERE u.external_auth_id = $1 AND c.provider = $2
            AND (($3::text IS NULL AND c.site_id IS NULL) OR c.site_id::text = $3 OR EXISTS (SELECT 1 FROM sites s WHERE s.id = c.site_id AND s.legacy_site_id = $3))
          ORDER BY c.updated_at DESC LIMIT 1`, [userId, provider, siteId || null]
      );
      return result.rows[0] ? map(result.rows[0]) : null;
    },
    async save(connection) {
      const owner = await accountAndSite(connection.userId, connection.siteId);
      if (!owner) throw new Error('OAUTH_OWNER_NOT_FOUND');
      await pool.query(
        `INSERT INTO oauth_connections
          (id, account_id, site_id, provider, connection_state, scopes, encrypted_access_token, encrypted_refresh_token,
           access_token_expires_at, refresh_lock_until, token_version, connect_idempotency_key, revoked_at, last_error, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, convert_to($7, 'utf8'), CASE WHEN $8 IS NULL THEN NULL ELSE convert_to($8, 'utf8') END,
                 CASE WHEN $9 IS NULL THEN NULL ELSE to_timestamp($9 / 1000.0) END,
                 CASE WHEN $10 IS NULL THEN NULL ELSE to_timestamp($10 / 1000.0) END,
                 $11, $1, CASE WHEN $5 = 'revoked' THEN now() ELSE NULL END, NULL, now())
         ON CONFLICT (account_id, provider, site_id) DO UPDATE SET
           id = EXCLUDED.id, connection_state = EXCLUDED.connection_state, scopes = EXCLUDED.scopes,
           encrypted_access_token = EXCLUDED.encrypted_access_token, encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
           access_token_expires_at = EXCLUDED.access_token_expires_at, refresh_lock_until = EXCLUDED.refresh_lock_until,
           token_version = EXCLUDED.token_version, revoked_at = EXCLUDED.revoked_at, last_error = EXCLUDED.last_error, updated_at = now()`,
        [connection.id, owner.account_id, owner.site_id, connection.provider, connection.state, connection.scopes,
          connection.encryptedAccessToken, connection.encryptedRefreshToken || null, connection.expiresAt ?? null,
          connection.refreshLockUntil ?? null, connection.tokenVersion]
      );
    },
    async claimRefreshLock(id, lockUntil) {
      const result = await pool.query(
        `UPDATE oauth_connections SET connection_state = 'refreshing', refresh_lock_until = to_timestamp($2 / 1000.0), updated_at = now()
          WHERE id = $1 AND connection_state IN ('connected', 'refreshing')
            AND (refresh_lock_until IS NULL OR refresh_lock_until <= now())`, [id, lockUntil]
      );
      return result.rowCount === 1;
    },
    async releaseRefreshLock(id) {
      await pool.query(`UPDATE oauth_connections SET refresh_lock_until = NULL, connection_state = CASE WHEN connection_state = 'refreshing' THEN 'connected' ELSE connection_state END, updated_at = now() WHERE id = $1`, [id]);
    },
    async revoke(id, updatedAt) {
      await pool.query(`UPDATE oauth_connections SET connection_state = 'revoked', revoked_at = $2, refresh_lock_until = NULL, updated_at = $2 WHERE id = $1`, [id, updatedAt]);
    }
  };
}
