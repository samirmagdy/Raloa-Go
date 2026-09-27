import assert from 'node:assert/strict';
import { AUDIT_ACTIONS } from './server/audit/contracts';
import { InMemoryAuditRepository } from './server/audit/memory';
import { createAuditService } from './server/audit/service';

const repository = new InMemoryAuditRepository();
const service = createAuditService(repository, () => new Date('2026-01-01T00:00:00.000Z'));
const entry = await service.record({
  actorUserId: 'user-1', siteId: 'site-1', resourceType: 'site', resourceId: 'site-1', action: 'site.published',
  metadata: { fromPublished: false, toPublished: true, accessToken: 'must-not-persist', nested: { password: 'nope' }, handle: 'creator' }
});
assert.equal(entry.occurredAt, '2026-01-01T00:00:00.000Z');
assert.deepEqual(entry.metadata, { fromPublished: false, toPublished: true, handle: 'creator' });
assert.equal((await repository.list('site', 'site-1')).length, 1);
assert.ok(AUDIT_ACTIONS.includes('domain.verified'));
assert.ok(AUDIT_ACTIONS.includes('billing.subscription_changed'));
assert.ok(AUDIT_ACTIONS.includes('order.fulfillment_changed'));
console.log('audit logging tests passed');

