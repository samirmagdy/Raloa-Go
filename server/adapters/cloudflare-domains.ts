import type { DomainProviderAdapter } from '../domains/domains/contracts';

type CloudflareRequest = (path: string, options?: RequestInit) => Promise<any>;

export function createCloudflareDomainAdapter(input: { request: CloudflareRequest; zoneId: string; origin: string }): DomainProviderAdapter {
  return {
    async provision({ hostname, siteId, idempotencyKey }) {
      const response = await input.request(`/zones/${input.zoneId}/custom_hostnames`, {
        method: 'POST',
        body: JSON.stringify({ hostname, ssl: { method: 'txt', type: 'dv' }, custom_metadata: { siteId, idempotencyKey } })
      });
      return {
        providerHostnameId: String(response.id),
        dnsInstructions: Array.isArray(response.dns_records) ? response.dns_records.map((record: any) => ({ type: record.type, name: record.name, value: record.content || record.value, ttl: record.ttl })) : [],
        certificateStatus: response.ssl?.status === 'active' ? 'active' : 'pending'
      };
    },
    async verify(providerHostnameId) {
      const response = await input.request(`/zones/${input.zoneId}/custom_hostnames/${encodeURIComponent(providerHostnameId)}`);
      return { verified: response.status === 'active', certificateStatus: response.ssl?.status === 'active' ? 'active' : 'pending' };
    },
    remove: (providerHostnameId) => input.request(`/zones/${input.zoneId}/custom_hostnames/${encodeURIComponent(providerHostnameId)}`, { method: 'DELETE' }).then(() => undefined)
  };
}
