import assert from 'node:assert/strict';
import { createDomainProvisioningService } from './server/domains/domains/provisioning-service';
import type { CustomDomain } from './server/domains/domains/contracts';

const domains = new Map<string, CustomDomain>();
let providerCalls = 0;
const service = createDomainProvisioningService({
  repository: {
    async get(id) { return domains.get(id) ?? null; },
    async findByHostname(hostname) { return [...domains.values()].find((domain) => domain.hostname === hostname) ?? null; },
    async findByIdempotencyKey(key) { return [...domains.values()].find((domain) => domain.idempotencyKey === key) ?? null; },
    async listOwned(ownerUserId) { return [...domains.values()].filter((domain) => domain.ownerUserId === ownerUserId); },
    async create(domain) { domains.set(domain.id, domain); },
    async update(id, changes) { const next = { ...domains.get(id)!, ...changes }; domains.set(id, next); return next; }
  },
  provider: {
    async provision() { providerCalls += 1; return { providerHostnameId: 'cf-1', dnsInstructions: [{ type: 'CNAME', name: 'example.test', value: 'target.test' }], certificateStatus: 'pending' as const }; },
    async verify() { return { verified: true, certificateStatus: 'active' as const }; },
    async remove() {}
  },
  clock: () => '2026-01-01T00:00:00.000Z'
});

const first = await service.provision({ id: 'domain-1', ownerUserId: 'user-1', siteId: 'site-1', hostname: 'Example.test.', idempotencyKey: 'domain-request-1' });
const replay = await service.provision({ id: 'domain-2', ownerUserId: 'user-1', siteId: 'site-1', hostname: 'example.test', idempotencyKey: 'domain-request-1' });
assert.equal(first.hostname, 'example.test');
assert.equal(replay.id, 'domain-1');
assert.equal(providerCalls, 1);
const verified = await service.verify({ domainId: first.id, ownerUserId: 'user-1' });
assert.equal(verified.provisioningState, 'verified');
assert.deepEqual(await service.resolvePublicRouting('example.test'), { hostname: 'example.test', siteId: 'site-1', publishedOnly: true });
await service.remove({ domainId: first.id, ownerUserId: 'user-1' });
assert.equal(await service.resolvePublicRouting('example.test'), null);
console.log('Domain provisioning tests passed');
