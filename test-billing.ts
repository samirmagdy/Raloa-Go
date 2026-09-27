import assert from 'node:assert/strict';
import { normalizedSubscriptionState } from './server-services';

const subscription = (status: string, currentPeriodEnd: number, cancelAtPeriodEnd = false) => ({
  status,
  cancel_at_period_end: cancelAtPeriodEnd,
  cancel_at: null,
  items: { data: [{ current_period_end: currentPeriodEnd }] }
}) as any;

assert.equal(normalizedSubscriptionState(subscription('trialing', 0)), 'trial');
assert.equal(normalizedSubscriptionState(subscription('active', 0)), 'active');
assert.equal(normalizedSubscriptionState(subscription('active', 0, true)), 'subscription_ending');
assert.equal(normalizedSubscriptionState(subscription('past_due', Math.floor(Date.now() / 1000) + 3600)), 'grace_period');
assert.equal(normalizedSubscriptionState(subscription('past_due', Math.floor(Date.now() / 1000) - 3600)), 'past_due');
assert.equal(normalizedSubscriptionState(subscription('incomplete', 0)), 'pending');
assert.equal(normalizedSubscriptionState(subscription('unpaid', 0)), 'failed_payment');
assert.equal(normalizedSubscriptionState(subscription('canceled', 0)), 'canceled');
console.log('PASS: Stripe billing states normalize to the Studio billing contract');
