import assert from 'node:assert/strict';
import type { AuthoritativeBillingState } from './server-services';
import { createEntitlementService } from './server/domains/billing/entitlement-service';

const state = (effectivePlan: AuthoritativeBillingState['effectivePlan']): AuthoritativeBillingState => ({
  plan: effectivePlan, effectivePlan, interval: 'monthly', state: effectivePlan === 'free' ? 'free' : 'active', stripeStatus: effectivePlan === 'free' ? 'free' : 'active', renewalDate: null, trialEndsAt: null, cancellationDate: null, cancelAtPeriodEnd: false, customerId: null, subscriptionId: null, source: 'account'
});
const service = createEntitlementService({ billing: async () => state('pro'), clock: () => '2026-01-01T00:00:00.000Z' });
const pro = await service.resolve('user-1');
assert.equal(pro.accountId, 'user-1');
assert.equal(pro.entitlements.analytics, true);
assert.equal(pro.entitlements.maxLinks, null);
assert.equal(pro.evaluatedAt, '2026-01-01T00:00:00.000Z');
await service.assertEntitled('user-1', 'customDomains');
await assert.rejects(() => createEntitlementService({ billing: async () => state('free') }).assertEntitled('user-1', 'analytics'), /ENTITLEMENT_REQUIRED/);
await assert.rejects(() => createEntitlementService({ billing: async () => state('free') }).assertLimit('user-1', 'maxLinks', 11), /ENTITLEMENT_LIMIT_EXCEEDED/);
console.log('Entitlement service tests passed');
