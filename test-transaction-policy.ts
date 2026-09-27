import assert from 'node:assert/strict';
import { TRANSACTION_POLICIES } from './server/infrastructure/transactions/policy';

for (const name of [
  'bookingReservation',
  'inventoryReservation',
  'paymentReconciliation',
  'subscriptionUpdate',
  'slugUniqueness',
  'fulfillment'
] as const) {
  const policy = TRANSACTION_POLICIES[name];
  assert.equal(policy.consistency, 'strong', `${name} must be strongly consistent`);
  assert.equal(policy.idempotencyRequired, true, `${name} must be idempotent`);
}

assert.equal(TRANSACTION_POLICIES.bookingReservation.databaseBoundary, 'single_transaction');
assert.equal(TRANSACTION_POLICIES.inventoryReservation.externalCalls, 'after_commit');
assert.equal(TRANSACTION_POLICIES.paymentReconciliation.externalCalls, 'before_transaction');
assert.equal(TRANSACTION_POLICIES.calendarSync.consistency, 'eventual');
console.log('Transaction policy tests passed');
