import type { CustomDomain, DomainProvisioningService, DomainRepository, DomainProviderAdapter } from './contracts';

const normalizeHostname = (hostname: string): string => hostname.trim().toLowerCase().replace(/\.$/, '');

export function createDomainProvisioningService(dependencies: {
  repository: DomainRepository;
  provider: DomainProviderAdapter;
  clock?: () => string;
}): DomainProvisioningService {
  const clock = dependencies.clock ?? (() => new Date().toISOString());

  return {
    listOwned: (ownerUserId) => dependencies.repository.listOwned(ownerUserId),
    async provision(input) {
      const hostname = normalizeHostname(input.hostname);
      if (!hostname || hostname.includes('/') || hostname.length > 253) throw new Error('Invalid hostname');
      const existing = await dependencies.repository.findByIdempotencyKey(input.idempotencyKey);
      if (existing) return existing;
      const byHostname = await dependencies.repository.findByHostname(hostname);
      if (byHostname && byHostname.ownerUserId !== input.ownerUserId) throw new Error('Domain is already owned');
      if (byHostname && byHostname.siteId === input.siteId) return byHostname;
      const timestamp = clock();
      const domain: CustomDomain = {
        id: input.id,
        hostname,
        ownerUserId: input.ownerUserId,
        siteId: input.siteId,
        idempotencyKey: input.idempotencyKey,
        provisioningState: 'provisioning',
        verificationStatus: 'pending',
        certificateStatus: 'pending',
        dnsInstructions: [],
        routing: { hostname, siteId: input.siteId, publishedOnly: true },
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await dependencies.repository.create(domain);
      try {
        const result = await dependencies.provider.provision({ hostname, siteId: input.siteId, idempotencyKey: input.idempotencyKey });
        return dependencies.repository.update(domain.id, {
          provisioningState: 'pending',
          providerHostnameId: result.providerHostnameId,
          dnsInstructions: result.dnsInstructions,
          certificateStatus: result.certificateStatus,
          updatedAt: clock()
        });
      } catch (error) {
        return dependencies.repository.update(domain.id, { provisioningState: 'failed', lastError: error instanceof Error ? error.message : String(error), updatedAt: clock() });
      }
    },
    async verify(input) {
      const domain = await dependencies.repository.get(input.domainId);
      if (!domain || domain.ownerUserId !== input.ownerUserId || !domain.providerHostnameId) throw new Error('Domain not found');
      const result = await dependencies.provider.verify(domain.providerHostnameId);
      return dependencies.repository.update(domain.id, {
        provisioningState: result.verified ? 'verified' : 'pending',
        verificationStatus: result.verified ? 'verified' : 'pending',
        certificateStatus: result.certificateStatus,
        updatedAt: clock()
      });
    },
    async remove(input) {
      const domain = await dependencies.repository.get(input.domainId);
      if (!domain || domain.ownerUserId !== input.ownerUserId) throw new Error('Domain not found');
      if (domain.providerHostnameId) await dependencies.provider.remove(domain.providerHostnameId);
      await dependencies.repository.update(domain.id, { provisioningState: 'deleted', updatedAt: clock() });
    },
    async resolvePublicRouting(hostname) {
      const domain = await dependencies.repository.findByHostname(normalizeHostname(hostname));
      return domain?.provisioningState === 'verified' && domain.verificationStatus === 'verified' && domain.certificateStatus === 'active' ? domain.routing : null;
    }
  };
}
