import Stripe from 'stripe';
import { createCheckoutSession as legacyCreateCheckoutSession, createPortalSession as legacyCreatePortalSession, handleStripeWebhook as legacyHandleStripeWebhook, isStripeConfigured, stripe } from '../../server-services';
import type { AuthenticatedUser } from '../../server-services';

export type StripeEventKind = 'checkout_completed' | 'checkout_expired' | 'payment_failed' | 'payment_refunded' | 'subscription_created' | 'subscription_updated' | 'subscription_deleted' | 'invoice_payment_failed' | 'invoice_paid';

/** Provider-neutral event. Stripe SDK objects must not cross this boundary. */
export type ProviderBillingEvent = {
  provider: 'stripe'; eventId: string; eventType: string; kind: StripeEventKind;
  customerId?: string; subscriptionId?: string; paymentId?: string; checkoutSessionId?: string;
  orderId?: string; userId?: string; plan?: string; interval?: 'monthly' | 'yearly'; status?: string;
  entitlementState?: string; amountMinor?: number; currency?: string;
  currentPeriodEnd?: string | null; trialEnd?: string | null; cancelAt?: string | null;
  cancelAtPeriodEnd?: boolean; payload: Record<string, unknown>;
};

export type StripeWebhookEnvelope = { eventId: string; eventType: string; payload: Record<string, unknown>; billingEvent: ProviderBillingEvent };

export interface StripeProviderAdapter {
  readonly name: 'stripe';
  isConfigured(): boolean;
  createCheckoutSession(...args: any[]): Promise<any>;
  createPaymentCheckoutSession(input: { orderId: string; productId: string; creatorId: string; creatorHandle: string; customerEmail: string; quantity: number; currency: string; unitPriceMinor?: number; providerPriceId?: string; successUrl: string; cancelUrl: string; idempotencyKey: string }): Promise<{ id: string; url: string }>;
  reconcileCustomer(customerId: string): Promise<ProviderBillingEvent[]>;
  createPortalSession(...args: any[]): Promise<any>;
  handleWebhook(...args: any[]): Promise<any>;
  verifyWebhook(payload: string | Buffer, signature: string): StripeWebhookEnvelope;
  handleLegacyWebhook(payload: string | Buffer, signature: string): Promise<void>;
  createRefund(paymentId: string, amountMinor?: number, requestId?: string): Promise<{ refundId: string; status: string }>;
}

function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' ? value as Record<string, unknown> : {}; }
function metadata(value: unknown): Record<string, string> { return Object.fromEntries(Object.entries(record(value)).filter(([, item]) => typeof item === 'string')) as Record<string, string>; }
function iso(seconds: unknown): string | null { return typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : null; }

function normalizeEvent(event: Stripe.Event): ProviderBillingEvent {
  const object = record(event.data.object); const meta = metadata(object.metadata);
  const base = { provider: 'stripe' as const, eventId: event.id, eventType: event.type, payload: record(event) };
  if (event.type.startsWith('checkout.session.')) {
    const kind: StripeEventKind = event.type === 'checkout.session.expired' ? 'checkout_expired' : event.type === 'checkout.session.async_payment_failed' ? 'payment_failed' : 'checkout_completed';
    return { ...base, kind, checkoutSessionId: String(object.id), customerId: typeof object.customer === 'string' ? object.customer : undefined, subscriptionId: typeof object.subscription === 'string' ? object.subscription : undefined, paymentId: typeof object.payment_intent === 'string' ? object.payment_intent : undefined, orderId: meta.orderId, userId: meta.uid, plan: meta.plan, interval: meta.isYearly === 'true' ? 'yearly' : 'monthly', status: typeof object.payment_status === 'string' ? object.payment_status : undefined, amountMinor: typeof object.amount_total === 'number' ? object.amount_total : undefined, currency: typeof object.currency === 'string' ? object.currency : undefined };
  }
  if (event.type.startsWith('customer.subscription.')) {
    const items = record(object.items); const first = Array.isArray(items.data) ? record(items.data[0]) : {}; const price = record(first.price); const recurring = record(price.recurring); const priceId = typeof price.id === 'string' ? price.id : undefined;
    const periodEnd = iso(object.current_period_end); const trialEnd = iso(object.trial_end); const cancelAt = iso(object.cancel_at) || (object.cancel_at_period_end === true ? periodEnd : null);
    return { ...base, kind: event.type === 'customer.subscription.created' ? 'subscription_created' : event.type === 'customer.subscription.deleted' ? 'subscription_deleted' : 'subscription_updated', customerId: typeof object.customer === 'string' ? object.customer : undefined, subscriptionId: String(object.id), userId: meta.uid, plan: meta.plan, interval: meta.isYearly === 'true' || recurring.interval === 'year' ? 'yearly' : 'monthly', status: typeof object.status === 'string' ? object.status : undefined, entitlementState: typeof object.status === 'string' ? object.status : undefined, currentPeriodEnd: periodEnd, trialEnd, cancelAt, cancelAtPeriodEnd: object.cancel_at_period_end === true, payload: { ...record(event), providerPriceId: priceId } };
  }
  const kind: StripeEventKind = event.type === 'invoice.payment_failed' ? 'invoice_payment_failed' : event.type === 'invoice.paid' ? 'invoice_paid' : 'payment_refunded';
  return { ...base, kind, customerId: typeof object.customer === 'string' ? object.customer : undefined, paymentId: typeof object.payment_intent === 'string' ? object.payment_intent : undefined, amountMinor: typeof object.amount_paid === 'number' ? object.amount_paid : typeof object.amount_refunded === 'number' ? object.amount_refunded : undefined, currency: typeof object.currency === 'string' ? object.currency : undefined, status: typeof object.status === 'string' ? object.status : undefined };
}

export function createStripeAdapter(dependencies?: { isConfigured?: () => boolean; createCheckoutSession?: (...args: any[]) => Promise<any>; createPortalSession?: (...args: any[]) => Promise<any>; handleWebhook?: (...args: any[]) => Promise<any> }): StripeProviderAdapter {
  if (dependencies) {
    return { name: 'stripe', isConfigured: dependencies.isConfigured || isStripeConfigured, createCheckoutSession: dependencies.createCheckoutSession || legacyCreateCheckoutSession, createPaymentCheckoutSession: async () => { throw new Error('STRIPE_NOT_CONFIGURED'); }, reconcileCustomer: async () => [], createPortalSession: dependencies.createPortalSession || legacyCreatePortalSession, handleWebhook: dependencies.handleWebhook || legacyHandleStripeWebhook, verifyWebhook: (payload, signature) => createStripeAdapter().verifyWebhook(payload, signature), handleLegacyWebhook: dependencies.handleWebhook || legacyHandleStripeWebhook, createRefund: async () => { throw new Error('STRIPE_NOT_CONFIGURED'); } };
  }
  return {
    name: 'stripe', isConfigured: isStripeConfigured,
    createCheckoutSession: legacyCreateCheckoutSession,
    async createPaymentCheckoutSession(input) {
      if (!stripe) throw new Error('STRIPE_NOT_CONFIGURED');
      const lineItem = input.providerPriceId ? { price: input.providerPriceId, quantity: input.quantity } : { price_data: { currency: input.currency, product_data: { name: input.productId }, unit_amount: input.unitPriceMinor || 0 }, quantity: input.quantity };
      const session = await stripe.checkout.sessions.create({ mode: 'payment', line_items: [lineItem], customer_email: input.customerEmail, success_url: input.successUrl, cancel_url: input.cancelUrl, metadata: { orderId: input.orderId, productId: input.productId, creatorId: input.creatorId, creatorHandle: input.creatorHandle } }, { idempotencyKey: input.idempotencyKey });
      if (!session.url) throw new Error('STRIPE_CHECKOUT_URL_MISSING');
      return { id: session.id, url: session.url };
    },
    async reconcileCustomer(customerId) {
      if (!stripe) throw new Error('STRIPE_NOT_CONFIGURED');
      const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 });
      return subscriptions.data.map((subscription) => {
        const raw = subscription as unknown as Record<string, unknown>;
        const meta = metadata(raw.metadata); const items = record(raw.items); const first = Array.isArray(items.data) ? record(items.data[0]) : {}; const price = record(first.price); const recurring = record(price.recurring);
        const currentPeriodEnd = iso(raw.current_period_end); const trialEnd = iso(raw.trial_end); const cancelAt = iso(raw.cancel_at) || (raw.cancel_at_period_end === true ? currentPeriodEnd : null);
        return { provider: 'stripe' as const, eventId: `reconciliation:${subscription.id}:${String(raw.current_period_end || '')}`, eventType: 'customer.subscription.updated', kind: 'subscription_updated' as const, customerId, subscriptionId: subscription.id, userId: meta.uid, plan: meta.plan, interval: meta.isYearly === 'true' || recurring.interval === 'year' ? 'yearly' as const : 'monthly' as const, status: typeof raw.status === 'string' ? raw.status : undefined, entitlementState: typeof raw.status === 'string' ? raw.status : undefined, currentPeriodEnd, trialEnd, cancelAt, cancelAtPeriodEnd: raw.cancel_at_period_end === true, payload: { providerPriceId: typeof price.id === 'string' ? price.id : undefined } };
      });
    },
    createPortalSession: legacyCreatePortalSession,
    handleWebhook: legacyHandleStripeWebhook,
    verifyWebhook(payload, signature) {
      if (!stripe) throw new Error('STRIPE_NOT_CONFIGURED'); const secret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET_NOT_CONFIGURED');
      const event = stripe.webhooks.constructEvent(payload, signature, secret);
      return { eventId: event.id, eventType: event.type, payload: record(event), billingEvent: normalizeEvent(event) };
    },
    handleLegacyWebhook: legacyHandleStripeWebhook,
    async createRefund(paymentId, amountMinor, requestId) {
      if (!stripe) throw new Error('STRIPE_NOT_CONFIGURED');
      const refund = await stripe.refunds.create({ payment_intent: paymentId, ...(amountMinor ? { amount: amountMinor } : {}) }, requestId ? { idempotencyKey: requestId } : undefined);
      return { refundId: refund.id, status: refund.status || 'pending' };
    }
  };
}

export const stripeAdapter = createStripeAdapter();
