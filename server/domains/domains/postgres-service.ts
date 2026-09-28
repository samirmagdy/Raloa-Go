import type { CustomDomain, DomainProviderAdapter, DomainRepository } from './contracts';

const normalizeHostname = (hostname: string): string => hostname.trim().toLowerCase().replace(/\.$/, '');

export function createPostgresDomainService(dependencies: { repository: DomainRepository; provider: DomainProviderAdapter; clock?: () => string }) {
  const clock = dependencies.clock || (() => new Date().toISOString());
  const repo = dependencies.repository;

  return {
    listOwned: (ownerUserId: string) => repo.listOwned(ownerUserId),
    async add(input: { id: string; ownerUserId: string; siteId: string; hostname: string; idempotencyKey: string }): Promise<CustomDomain> {
      const hostname = normalizeHostname(input.hostname);
      if (!hostname || hostname.includes('/') || hostname.length > 253 || !hostname.includes('.')) throw new Error('INVALID_DOMAIN_HOSTNAME');
      const existing = await repo.findByIdempotencyKey(input.idempotencyKey);
      if (existing) return existing;
      const byHostname = await repo.findByHostname(hostname);
      if (byHostname && byHostname.ownerUserId !== input.ownerUserId) throw new Error('DOMAIN_ALREADY_OWNED');
      if (byHostname) return byHostname;
      const now = clock();
      const domain: CustomDomain = { id: input.id, hostname, ownerUserId: input.ownerUserId, siteId: input.siteId, idempotencyKey: input.idempotencyKey, provisioningState: 'pending', verificationStatus: 'pending', certificateStatus: 'pending', dnsInstructions: [], routing: { hostname, siteId: input.siteId, publishedOnly: true }, createdAt: now, updatedAt: now };
      await repo.create(domain);
      return domain;
    },
    async provision(domainId: string, terminal = false): Promise<CustomDomain> {
      const domain = await repo.get(domainId);
      if (!domain || domain.provisioningState === 'deleted') throw new Error('DOMAIN_NOT_FOUND');
      try {
        const result = await dependencies.provider.provision({ hostname: domain.hostname, siteId: domain.siteId, idempotencyKey: domain.idempotencyKey });
        return repo.update(domain.id, { provisioningState: 'pending', providerHostnameId: result.providerHostnameId, dnsInstructions: result.dnsInstructions, certificateStatus: result.certificateStatus, lastError: undefined, updatedAt: clock() });
      } catch (error) {
        await repo.update(domain.id, { provisioningState: terminal ? 'failed' : 'pending', verificationStatus: terminal ? 'failed' : 'pending', certificateStatus: terminal ? 'failed' : 'pending', lastError: error instanceof Error ? error.message : 'DOMAIN_PROVISIONING_FAILED', updatedAt: clock() });
        throw error;
      }
    },
    async verify(domainId: string, terminal = false): Promise<CustomDomain> {
      const domain = await repo.get(domainId);
      if (!domain || domain.provisioningState === 'deleted') throw new Error('DOMAIN_NOT_FOUND');
      if (!domain.providerHostnameId) throw new Error('DOMAIN_PROVIDER_HOSTNAME_MISSING');
      const result = await dependencies.provider.verify(domain.providerHostnameId);
      const ready = result.verified && result.certificateStatus === 'active';
      const updated = await repo.update(domain.id, { provisioningState: ready ? 'verified' : terminal ? 'failed' : 'pending', verificationStatus: ready ? 'verified' : terminal ? 'failed' : 'pending', certificateStatus: result.certificateStatus, lastError: ready ? undefined : terminal ? 'DOMAIN_VERIFICATION_MAX_ATTEMPTS' : 'DOMAIN_DNS_OR_SSL_PENDING', updatedAt: clock() });
      if (!ready) throw new Error(terminal ? 'DOMAIN_VERIFICATION_FAILED' : 'DOMAIN_VERIFICATION_PENDING');
      return updated;
    },
    async remove(domainId: string): Promise<void> {
      const domain = await repo.get(domainId);
      if (!domain) throw new Error('DOMAIN_NOT_FOUND');
      try {
        if (domain.providerHostnameId) await dependencies.provider.remove(domain.providerHostnameId);
        await repo.update(domain.id, { provisioningState: 'deleted', verificationStatus: 'failed', certificateStatus: 'failed', lastError: undefined, updatedAt: clock() });
      } catch (error) {
        await repo.update(domain.id, { provisioningState: 'failed', lastError: error instanceof Error ? error.message : 'DOMAIN_REMOVAL_FAILED', updatedAt: clock() });
        throw error;
      }
    },
    async resolvePublicRouting(hostname: string) {
      const domain = await repo.findByHostname(normalizeHostname(hostname));
      return domain && domain.provisioningState === 'verified' && domain.verificationStatus === 'verified' && domain.certificateStatus === 'active' ? domain.routing : null;
    }
  };
}
