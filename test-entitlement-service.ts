import assert from 'node:assert/strict';
import type { AuthoritativeBillingState } from './server-services';
import { createEntitlementService } from './server/domains/billing/entitlement-service';

const state = (effectivePlan: AuthoritativeBillingState['effectivePlan']): AuthoritativeBillingState => ({
  plan: effectivePlan, effectivePlan, interval: 'monthly', state: effectivePlan === 'free' ? 'free' : 'active', stripeStatus: effectivePlan === 'free' ? 'free' : 'active', renewalDate: null, trialEndsAt: null, cancellationDate: null, cancelAtPeriodEnd: false, customerId: null, subscriptionId: null, source: 'account'
});
const service = createEntitlementService({ billing: async () => state('pro'), clock: () => '2026-01-01T00:00:00.000Z' });
const pro = await service.resolve('user-1');
assert.equal(pro.accountId, 'user-1');
assert.equal(pro.plan, 'pro');
assert.equal(pro.entitlements.analytics, true);
assert.equal(pro.entitlements.maxLinks, null);
assert.equal(pro.capabilities.studioFeatures.analyticsDashboard, true);
assert.equal(pro.capabilities.integrationAvailability.googleCalendar, true);
assert.equal(pro.evaluatedAt, '2026-01-01T00:00:00.000Z');
await service.assertEntitled('user-1', 'customDomains');
const freeService = createEntitlementService({ billing: async () => state('free') });
const free = await freeService.resolve('user-1');
assert.equal(free.plan, 'free');
assert.equal(free.capabilities.analytics, false);
assert.equal(free.capabilities.premiumTemplates, false);
assert.equal(free.capabilities.customDomains, false);
assert.equal(free.capabilities.integrationAvailability.googleCalendar, false);
assert.equal(free.capabilities.studioFeatures.advancedControls, false);
await assert.rejects(() => freeService.assertEntitled('user-1', 'analytics'), /ENTITLEMENT_REQUIRED/);
await assert.rejects(() => freeService.assertEntitled('user-1', 'googleCalendar'), /ENTITLEMENT_REQUIRED/);
await assert.rejects(() => freeService.assertLimit('user-1', 'maxLinks', 11), /ENTITLEMENT_LIMIT_EXCEEDED/);

let current = state('free');
const changingService = createEntitlementService({ billing: async () => current });
assert.equal((await changingService.resolve('user-1')).capabilities.analytics, false);
current = state('studio');
const studio = await changingService.resolve('user-1');
assert.equal(studio.plan, 'studio');
assert.equal(studio.capabilities.analytics, true);
assert.equal(studio.capabilities.studioFeatures.advancedControls, true);
assert.ok(studio.capabilities.allowedBlockTypes.includes('video'));
console.log('Entitlement service tests passed');
