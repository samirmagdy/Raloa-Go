import type { Pool } from 'pg';
import type { AccountContext, AuthDataSource, AuthenticatedUser, AuthorizationResource, OwnedResource, Role, SiteContext } from '@raloa/auth';

export function createPostgresAuthDataSource(pool: Pool): AuthDataSource {
  return {
    async findUserByFirebaseUid(firebaseUid: string): Promise<AuthenticatedUser | null> {
      const result = await pool.query<{ id: string; external_auth_id: string; email: string | null }>(
        'SELECT id, external_auth_id, email FROM app_users WHERE external_auth_id = $1 LIMIT 1', [firebaseUid]
      );
      const row = result.rows[0];
      return row ? { id: row.id, firebaseUid: row.external_auth_id, email: row.email || undefined } : null;
    },
    async findAccountForUser(userId: string, accountId?: string): Promise<AccountContext | null> {
      const values: string[] = [userId];
      const filter = accountId ? 'AND a.id = $2' : '';
      if (accountId) values.push(accountId);
      const result = await pool.query<{ id: string; primary_user_id: string; plan: string; role: Role }>(
        `SELECT a.id, a.primary_user_id, COALESCE(active_subscription.plan, 'free') AS plan, am.role
           FROM accounts a
           JOIN account_memberships am ON am.account_id = a.id AND am.user_id = (SELECT id FROM app_users WHERE id = $1)
           LEFT JOIN LATERAL (
             SELECT s.plan FROM subscriptions s
              WHERE s.user_id = (SELECT id FROM app_users WHERE id = $1)
                AND s.status IN ('trialing', 'active', 'past_due')
              ORDER BY s.updated_at DESC LIMIT 1
           ) active_subscription ON true
          WHERE am.user_id = (SELECT id FROM app_users WHERE id = $1) ${filter}
          ORDER BY CASE WHEN a.primary_user_id = (SELECT id FROM app_users WHERE id = $1) THEN 0 ELSE 1 END, a.created_at
          LIMIT 1`, values
      );
      const row = result.rows[0];
      return row ? { id: row.id, primaryUserId: row.primary_user_id, plan: row.plan, role: row.role } : null;
    },
    async findSite(siteId: string): Promise<SiteContext | null> {
      const result = await pool.query<{ id: string; account_id: string | null; owner_user_id: string; handle: string }>(
        'SELECT id, account_id, owner_user_id, handle FROM sites WHERE id::text = $1 OR legacy_site_id = $1 LIMIT 1', [siteId]
      );
      const row = result.rows[0];
      return row?.account_id ? { id: row.id, accountId: row.account_id, ownerUserId: row.owner_user_id, handle: row.handle } : null;
    },
    async findMembership(userId: string, accountId: string): Promise<Role | null> {
      const result = await pool.query<{ role: Role }>(
        `SELECT am.role FROM account_memberships am JOIN app_users u ON u.id = am.user_id
          WHERE u.id = $1 AND am.account_id = $2 LIMIT 1`, [userId, accountId]
      );
      return result.rows[0]?.role || null;
    },
    async resolveEntitlements(account) {
      const enabled = account.plan !== 'free';
      return { analytics: enabled, customDomains: enabled, studioControls: enabled };
    },
    async findResource(resource: AuthorizationResource, resourceId: string): Promise<OwnedResource | null> {
      // Keep this allowlisted: resource names never become SQL identifiers.
      const queries: Partial<Record<AuthorizationResource, string>> = {
        site: 'SELECT id::text AS id, account_id::text AS account_id, owner_user_id::text AS owner_user_id FROM sites WHERE id::text = $1 OR legacy_site_id = $1 LIMIT 1',
        audience: 'SELECT id::text AS id, account_id::text AS account_id, site_id::text AS site_id FROM audience_subscribers WHERE id::text = $1 LIMIT 1',
        booking: 'SELECT id::text AS id, site_id::text AS site_id, host_user_id::text AS owner_user_id FROM bookings WHERE id::text = $1 LIMIT 1',
        product: 'SELECT id::text AS id, site_id::text AS site_id, creator_user_id::text AS owner_user_id FROM products WHERE id::text = $1 LIMIT 1',
        order: 'SELECT id::text AS id, site_id::text AS site_id, creator_user_id::text AS owner_user_id FROM orders WHERE id::text = $1 LIMIT 1',
        domain: 'SELECT id::text AS id, site_id::text AS site_id, owner_user_id::text AS owner_user_id FROM custom_domains WHERE id::text = $1 LIMIT 1',
        media: 'SELECT id::text AS id, site_id::text AS site_id, owner_user_id::text AS owner_user_id FROM media_assets WHERE id::text = $1 LIMIT 1',
        integration: 'SELECT id::text AS id, site_id::text AS site_id, user_id::text AS owner_user_id FROM integrations WHERE id::text = $1 LIMIT 1',
        analytics: 'SELECT site_id::text AS id, site_id::text AS site_id, site_owner_id::text AS owner_user_id FROM analytics_daily_rollups WHERE site_id::text = $1 LIMIT 1',
        publishing: 'SELECT id::text AS id, account_id::text AS account_id, owner_user_id::text AS owner_user_id FROM sites WHERE (id::text = $1 OR legacy_site_id = $1) LIMIT 1',
        billing: 'SELECT id::text AS id, id::text AS account_id FROM accounts WHERE id::text = $1 LIMIT 1',
        account: 'SELECT id::text AS id, id::text AS account_id FROM accounts WHERE id::text = $1 LIMIT 1'
      };
      const query = resource === 'destructive' ? queries.site : queries[resource];
      if (!query) return null;
      const result = await pool.query<{ id: string; account_id?: string | null; site_id?: string | null; owner_user_id?: string | null }>(query, [resourceId]);
      const row = result.rows[0];
      if (!row) return null;
      return {
        resource,
        id: row.id,
        accountId: row.account_id || undefined,
        siteId: row.site_id || (resource === 'site' || resource === 'publishing' ? row.id : undefined),
        ownerUserId: row.owner_user_id || undefined
      };
    }
  };
}
