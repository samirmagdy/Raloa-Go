import assert from 'node:assert/strict';
import { createStripeAdapter } from './server/adapters/stripe';
import { createPostgresPaymentService } from './server/domains/billing/payment-service';

const event = {
  provider: 'stripe' as const,
  eventId: 'evt_test_1',
  eventType: 'customer.subscription.updated',
  kind: 'subscription_updated' as const,
  customerId: 'cus_test_1',
  subscriptionId: 'sub_test_1',
  userId: 'firebase-user-1',
  plan: 'pro',
  interval: 'monthly' as const,
  status: 'active',
  currentPeriodEnd: '2027-01-01T00:00:00.000Z',
  trialEnd: null,
  cancelAt: null,
  cancelAtPeriodEnd: false,
  payload: { providerPriceId: 'price_test_1' }
};

const queries: string[] = [];
const rows = new Map<string, unknown>();
const client = {
  async query(sql: string) {
    queries.push(sql);
    if (sql.includes('FROM billing_webhook_events')) return { rows: rows.has(event.eventId) ? [{ status: 'processed' }] : [], rowCount: 0 };
    if (sql.includes('FROM app_users')) return { rows: [{ id: 'user-db-1' }], rowCount: 1 };
    if (sql.includes('FROM billing_customers')) return { rows: [], rowCount: 0 };
    rows.set(event.eventId, { status: 'processed' });
    return { rows: [], rowCount: 1 };
  },
  release() {}
};
const pool = { connect: async () => client } as never;
const service = createPostgresPaymentService(pool);
const first = await service.process(event);
const second = await service.process(event);
assert.equal(first.processed, true);
assert.equal(second.duplicate, true);
assert.ok(queries.some((query) => query.includes('billing_webhook_events')));
assert.equal(typeof createStripeAdapter().verifyWebhook, 'function');
console.log('Payment domain tests passed');
