import type { Pool } from 'pg';
import type { CustomDomain, DomainRepository, DnsInstruction } from '../../domains/domains/contracts';

type DomainRow = {
  id: string; hostname: string; external_auth_id: string; site_id: string; site_handle: string;
  idempotency_key: string; provisioning_state: CustomDomain['provisioningState'];
  verification_status: CustomDomain['verificationStatus']; ssl_status: CustomDomain['certificateStatus'];
  provider_hostname_id: string | null; dns_instructions: DnsInstruction[]; routing_config: Record<string, unknown>;
  last_error: string | null; created_at: Date; updated_at: Date;
};

function map(row: DomainRow): CustomDomain {
  return {
    id: row.id,
    hostname: row.hostname,
    ownerUserId: row.external_auth_id,
    siteId: row.site_id,
    idempotencyKey: row.idempotency_key,
    provisioningState: row.provisioning_state,
    verificationStatus: row.verification_status,
    certificateStatus: row.ssl_status,
    dnsInstructions: Array.isArray(row.dns_instructions) ? row.dns_instructions : [],
    routing: { hostname: row.hostname, siteId: row.site_id, publishedOnly: true, ...(row.routing_config || {}) },
    providerHostnameId: row.provider_hostname_id || undefined,
    lastError: row.last_error || undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

const select = `SELECT d.*, u.external_auth_id, s.handle AS site_handle
  FROM custom_domains d
  JOIN app_users u ON u.id = d.owner_user_id
  JOIN sites s ON s.id = d.site_id`;

export function createPostgresDomainsRepository(pool: Pool): DomainRepository & {
  getSiteForOwner(ownerUserId: string, siteId: string): Promise<{ id: string; handle: string; published: boolean } | null>;
} {
  return {
    async get(id) {
      const result = await pool.query<DomainRow>(`${select} WHERE d.id = $1 LIMIT 1`, [id]);
      return result.rows[0] ? map(result.rows[0]) : null;
    },
    async findByHostname(hostname) {
      const result = await pool.query<DomainRow>(`${select} WHERE d.hostname = $1 LIMIT 1`, [hostname.trim().toLowerCase().replace(/\.$/, '')]);
      return result.rows[0] ? map(result.rows[0]) : null;
    },
    async findByIdempotencyKey(key) {
      const result = await pool.query<DomainRow>(`${select} WHERE d.idempotency_key = $1 LIMIT 1`, [key]);
      return result.rows[0] ? map(result.rows[0]) : null;
    },
    async listOwned(ownerUserId) {
      const result = await pool.query<DomainRow>(`${select} WHERE u.external_auth_id = $1 AND d.provisioning_state <> 'deleted' ORDER BY d.created_at DESC`, [ownerUserId]);
      return result.rows.map(map);
    },
    async getSiteForOwner(ownerUserId, siteId) {
      const result = await pool.query<{ id: string; handle: string; published: boolean }>(
        `SELECT s.id::text AS id, s.handle, s.is_published AS published
           FROM sites s JOIN app_users u ON u.id = s.owner_user_id
          WHERE u.external_auth_id = $1 AND (s.id::text = $2 OR s.legacy_site_id = $2) LIMIT 1`, [ownerUserId, siteId]
      );
      return result.rows[0] || null;
    },
    async create(domain) {
      const owner = await this.getSiteForOwner(domain.ownerUserId, domain.siteId);
      if (!owner) throw new Error('DOMAIN_SITE_NOT_FOUND');
      await pool.query(
        `INSERT INTO custom_domains
          (id, owner_user_id, site_id, hostname, verification_status, ssl_status, provisioning_state,
           dns_instructions, routing_config, idempotency_key, last_error, created_at, updated_at)
         SELECT $1, u.id, s.id, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, $11
           FROM app_users u JOIN sites s ON s.owner_user_id = u.id
          WHERE u.external_auth_id = $2 AND (s.id::text = $12 OR s.legacy_site_id = $12)`,
        [domain.id, domain.ownerUserId, domain.hostname, domain.verificationStatus, domain.certificateStatus, domain.provisioningState,
          JSON.stringify(domain.dnsInstructions), JSON.stringify(domain.routing), domain.idempotencyKey, domain.lastError || null, domain.createdAt, domain.siteId]
      );
    },
    async update(id, changes) {
      const current = await this.get(id);
      if (!current) throw new Error('DOMAIN_NOT_FOUND');
      const next = { ...current, ...changes, routing: { ...current.routing, ...(changes.routing || {}) }, updatedAt: changes.updatedAt || new Date().toISOString() };
      await pool.query(
        `UPDATE custom_domains SET hostname = $2, verification_status = $3, ssl_status = $4, provisioning_state = $5,
          provider_hostname_id = $6, dns_instructions = $7::jsonb, routing_config = $8::jsonb, last_error = $9, updated_at = $10
         WHERE id = $1`,
        [id, next.hostname, next.verificationStatus, next.certificateStatus, next.provisioningState, next.providerHostnameId || null,
          JSON.stringify(next.dnsInstructions), JSON.stringify(next.routing), next.lastError || null, next.updatedAt]
      );
      return (await this.get(id))!;
    },
  };
}
