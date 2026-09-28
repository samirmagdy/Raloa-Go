import assert from 'node:assert/strict';
import { createPostgresDomainService } from './server/domains/domains/postgres-service';
import type { CustomDomain, DomainRepository } from './server/domains/domains/contracts';

const domains = new Map<string, CustomDomain>();
const repository: DomainRepository = {
  async get(id) { return domains.get(id) || null; },
  async findByHostname(hostname) { return [...domains.values()].find((domain) => domain.hostname === hostname) || null; },
  async findByIdempotencyKey(key) { return [...domains.values()].find((domain) => domain.idempotencyKey === key) || null; },
  async listOwned(userId) { return [...domains.values()].filter((domain) => domain.ownerUserId === userId); },
  async create(domain) { domains.set(domain.id, domain); },
  async update(id, changes) { const next = { ...domains.get(id)!, ...changes }; domains.set(id, next); return next; }
};

let provisionCalls = 0;
const service = createPostgresDomainService({
  repository,
  clock: () => '2026-01-01T00:00:00.000Z',
  provider: {
    async provision() { provisionCalls += 1; return { providerHostnameId: 'cf-host-1', dnsInstructions: [{ type: 'CNAME', name: 'example.test', value: 'target.test' }], certificateStatus: 'pending' as const }; },
    async verify() { return { verified: true, certificateStatus: 'active' as const }; },
    async remove() {}
  }
});

const added = await service.add({ id: 'domain-1', ownerUserId: 'user-1', siteId: 'site-1', hostname: 'Example.test.', idempotencyKey: 'domain:example.test:provision' });
assert.equal(added.provisioningState, 'pending');
assert.equal(provisionCalls, 0);
await service.provision(added.id);
const verified = await service.verify(added.id);
assert.equal(verified.provisioningState, 'verified');
assert.deepEqual(await service.resolvePublicRouting('example.test'), { hostname: 'example.test', siteId: 'site-1', publishedOnly: true });
await service.remove(added.id);
assert.equal(await service.resolvePublicRouting('example.test'), null);
console.log('PostgreSQL domain service tests passed');
