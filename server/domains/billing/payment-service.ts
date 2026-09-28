import type { Pool } from 'pg';
import { withPostgresTransaction } from '../../infrastructure/postgres/client';
import type { ProviderBillingEvent } from '../../adapters/stripe';

export type BillingEventResult = { duplicate: boolean; processed: boolean; reason?: string };

function entitlementFor(status: string | undefined, deleted: boolean): string {
  if (deleted || status === 'canceled' || status === 'cancelled') return 'canceled';
  if (status === 'past_due') return 'past_due';
  if (status === 'trialing') return 'trial';
  if (status === 'active') return 'active';
  if (status === 'incomplete') return 'pending';
  return 'free';
}

function isSupported(event: ProviderBillingEvent): boolean {
  return event.eventType.startsWith('checkout.session.') || event.eventType.startsWith('customer.subscription.') || event.eventType === 'invoice.payment_failed' || event.eventType === 'invoice.paid' || event.eventType === 'charge.refunded' || event.eventType === 'refund.created';
}

/** Keep the webhook ledger useful for reconciliation without retaining provider payloads. */
function ledgerPayload(event: ProviderBillingEvent): Record<string, unknown> {
  return {
    kind: event.kind,
    customerId: event.customerId || null,
    subscriptionId: event.subscriptionId || null,
    paymentId: event.paymentId || null,
    checkoutSessionId: event.checkoutSessionId || null,
    orderId: event.orderId || null,
    amountMinor: event.amountMinor ?? null,
    currency: event.currency || null,
    status: event.status || null,
    plan: event.plan || null,
    interval: event.interval || null,
    currentPeriodEnd: event.currentPeriodEnd || null,
    cancelAtPeriodEnd: event.cancelAtPeriodEnd === true,
  };
}

/** PostgreSQL is the internal source of truth; this service consumes only normalized provider events. */
export function createPostgresPaymentService(pool: Pool, dependencies: { reconcileOrder?: (event: ProviderBillingEvent) => Promise<unknown> } = {}) {
  async function ensureCustomer(client: { query: Function }, event: ProviderBillingEvent, userId: string | null) {
    if (!event.customerId || !userId) return;
    await client.query(`INSERT INTO billing_customers (user_id, provider, provider_customer_id) VALUES ($1, 'stripe', $2) ON CONFLICT (user_id) DO UPDATE SET provider_customer_id = EXCLUDED.provider_customer_id, updated_at = now()`, [userId, event.customerId]);
  }

  async function process(event: ProviderBillingEvent): Promise<BillingEventResult> {
    if (!isSupported(event)) return { duplicate: false, processed: false, reason: 'unsupported_event' };
    let userId: string | null = null;
    const result = await withPostgresTransaction(pool, async (client) => {
      const existing = await client.query(`SELECT status FROM billing_webhook_events WHERE provider = $1 AND provider_event_id = $2 FOR UPDATE`, ['stripe', event.eventId]);
      if (existing.rows[0]?.status === 'processed') return { duplicate: true, processed: true };
      await client.query(`INSERT INTO billing_webhook_events (provider, provider_event_id, event_type, status, payload, received_at, updated_at) VALUES ('stripe', $1, $2, 'processing', $3::jsonb, now(), now()) ON CONFLICT (provider, provider_event_id) DO UPDATE SET status = 'processing', payload = EXCLUDED.payload, updated_at = now()`, [event.eventId, event.eventType, JSON.stringify(ledgerPayload(event))]);
      if (event.userId) {
        const user = await client.query<{ id: string }>('SELECT id::text FROM app_users WHERE external_auth_id = $1 LIMIT 1', [event.userId]);
        userId = user.rows[0]?.id || null;
      }
      if (!userId && event.customerId) {
        const customer = await client.query<{ user_id: string }>('SELECT user_id::text FROM billing_customers WHERE provider = $1 AND provider_customer_id = $2 LIMIT 1', ['stripe', event.customerId]);
        userId = customer.rows[0]?.user_id || null;
      }
      await ensureCustomer(client, event, userId);
      if (event.paymentId && (event.kind === 'payment_refunded' || event.kind === 'payment_failed' || event.kind === 'invoice_payment_failed')) {
        await client.query(`UPDATE payments SET status = $2::payment_status, provider_event_id = $3, updated_at = now() WHERE provider = 'stripe' AND provider_payment_id = $1`, [event.paymentId, event.kind === 'payment_refunded' ? 'refunded' : 'failed', event.eventId]);
        if (!event.orderId) {
          const paymentOrder = await client.query<{ order_id: string }>(`SELECT order_id::text FROM payments WHERE provider = 'stripe' AND provider_payment_id = $1 LIMIT 1`, [event.paymentId]);
          if (paymentOrder.rows[0]) event.orderId = paymentOrder.rows[0].order_id;
        }
      }
      if (event.kind.startsWith('subscription_') && event.subscriptionId && userId) {
        const status = event.status === 'canceled' ? 'cancelled' : ['trialing', 'active', 'past_due', 'incomplete', 'paused'].includes(event.status || '') ? event.status : 'cancelled';
        const plan = event.plan === 'studio' ? 'studio' : event.plan === 'pro' ? 'pro' : 'free';
        const entitlement = entitlementFor(event.status, event.kind === 'subscription_deleted');
        await client.query(`INSERT INTO subscriptions (user_id, provider, provider_customer_id, provider_subscription_id, provider_price_id, plan, status, entitlement_state, interval, current_period_end, trial_end, cancel_at, cancel_at_period_end, renewed_at) VALUES ($1, 'stripe', $2, $3, $4, $5, $6::subscription_status, $7::entitlement_state, $8, $9, $10, $11, $12, CASE WHEN $6 = 'active' THEN now() ELSE NULL END) ON CONFLICT (user_id, provider) DO UPDATE SET provider_customer_id = EXCLUDED.provider_customer_id, provider_subscription_id = EXCLUDED.provider_subscription_id, provider_price_id = EXCLUDED.provider_price_id, plan = EXCLUDED.plan, status = EXCLUDED.status, entitlement_state = EXCLUDED.entitlement_state, interval = EXCLUDED.interval, current_period_end = EXCLUDED.current_period_end, trial_end = EXCLUDED.trial_end, cancel_at = EXCLUDED.cancel_at, cancel_at_period_end = EXCLUDED.cancel_at_period_end, renewed_at = COALESCE(EXCLUDED.renewed_at, subscriptions.renewed_at), updated_at = now()`, [userId, event.customerId || null, event.subscriptionId, typeof event.payload.providerPriceId === 'string' ? event.payload.providerPriceId : null, plan, status, entitlement, event.interval || null, event.currentPeriodEnd, event.trialEnd, event.cancelAt, event.cancelAtPeriodEnd === true]);
        const subscription = await client.query<{ id: string }>(`SELECT id::text FROM subscriptions WHERE user_id = $1 AND provider = 'stripe' LIMIT 1`, [userId]);
        if (subscription.rows[0]) {
          await client.query(`INSERT INTO outbox_events (event_type, event_version, aggregate_type, aggregate_id, idempotency_key, correlation_id, payload) VALUES ('SubscriptionChanged.v1', 1, 'subscription', $1, $2, $3, $4::jsonb) ON CONFLICT (idempotency_key) DO NOTHING`, [subscription.rows[0].id, `subscription:${subscription.rows[0].id}:${event.eventId}`, event.eventId, JSON.stringify({ accountId: userId, plan, status, entitlementVersion: 1 })]);
        }
      }
      if ((event.kind === 'invoice_payment_failed' || event.kind === 'invoice_paid') && userId) {
        await client.query(`UPDATE subscriptions SET status = $2::subscription_status, entitlement_state = $3::entitlement_state, updated_at = now() WHERE user_id = $1 AND provider = 'stripe'`, [userId, event.kind === 'invoice_payment_failed' ? 'past_due' : 'active', event.kind === 'invoice_payment_failed' ? 'past_due' : 'active']);
      }
      await client.query(`UPDATE billing_webhook_events SET status = 'processed', processed_at = now(), updated_at = now(), error_message = NULL WHERE provider = 'stripe' AND provider_event_id = $1`, [event.eventId]);
      return { duplicate: false, processed: true };
    });
    if (!result.duplicate && dependencies.reconcileOrder && (event.orderId || event.checkoutSessionId || event.kind === 'payment_refunded' || event.kind === 'payment_failed')) await dependencies.reconcileOrder(event);
    return result;
  }

  async function recordCustomerMapping(userExternalId: string, providerCustomerId: string) {
    await pool.query(`INSERT INTO billing_customers (user_id, provider, provider_customer_id) SELECT id, 'stripe', $2 FROM app_users WHERE external_auth_id = $1 ON CONFLICT (user_id) DO UPDATE SET provider_customer_id = EXCLUDED.provider_customer_id, updated_at = now()`, [userExternalId, providerCustomerId]);
  }

  async function reconcile(events: ProviderBillingEvent[]) {
    let processed = 0;
    for (const event of events) {
      const result = await process(event);
      if (result.processed && !result.duplicate) processed += 1;
    }
    return processed;
  }

  return { process, reconcile, recordCustomerMapping };
}
