import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import Stripe from 'stripe';
import { canonicalSiteToLegacy, normalizeSiteContent } from './src/lib/contentSchema';
import { normalizeSiteSlug, validateSiteSlug } from './src/lib/siteSlug';
import { assertProductionEnvironment } from './server-config.mjs';
import { assertOrderTransition, legacyOrderState, type OrderState } from './server/domains/orders/state-machine';

// Run before any Firebase, Stripe, or Cloudflare client is initialized.
assertProductionEnvironment();

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0319129908';
const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'ai-studio-raloadesignfirst-8ccbe7ea-5af1-4106-809a-71252bddde6f';
const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const adminApp = getApps().length ? getApps()[0] : initializeApp({ projectId: PROJECT_ID });
export const adminDb = getFirestore(adminApp, DATABASE_ID);
export const adminAuth = getAdminAuth(adminApp);
const STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || process.env.GCLOUD_STORAGE_BUCKET || `${PROJECT_ID}.firebasestorage.app`;
export const adminStorage = getStorage(adminApp).bucket(STORAGE_BUCKET);

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export interface AuthenticatedUser {
  uid: string;
  email?: string;
}

export interface DomainRecord {
  domainId: string;
  hostname: string;
  userId: string;
  siteId: string;
  siteHandle?: string;
  verificationToken: string;
  verificationStatus: 'pending' | 'verified' | 'failed';
  sslStatus: 'pending' | 'active' | 'failed';
  dnsRecords?: Array<{ type: 'CNAME' | 'A' | 'TXT'; name: string; value: string; is_verified: boolean }>;
  cloudflareHostnameId?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export function isAdminConfigured(): boolean {
  return Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.K_SERVICE || process.env.FIREBASE_ADMIN_ENABLED === 'true');
}

export function isStripeConfigured(): boolean {
  return Boolean(stripe);
}

export async function verifyBearerToken(token: string): Promise<AuthenticatedUser | null> {
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}

export function getPriceId(plan: 'pro' | 'studio', isYearly: boolean): string | null {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${isYearly ? 'YEARLY' : 'MONTHLY'}` as const;
  return process.env[key] || null;
}

export async function getUserByStripeCustomerId(customerId: string) {
  const snapshot = await adminDb.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
  return snapshot.docs[0] || null;
}

export async function updateUserBilling(uid: string, data: Record<string, unknown>): Promise<void> {
  await adminDb.collection('users').doc(uid).set({
    ...data,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

export async function findDomainByHostname(hostname: string): Promise<DomainRecord | null> {
  const snapshot = await adminDb.collection('custom_domains').where('hostname', '==', hostname).limit(1).get();
  const document = snapshot.docs[0];
  return document ? document.data() as DomainRecord : null;
}

export async function findDomainById(domainId: string): Promise<DomainRecord | null> {
  const snapshot = await adminDb.collection('custom_domains').doc(domainId).get();
  return snapshot.exists ? snapshot.data() as DomainRecord : null;
}

export async function saveDomain(domain: DomainRecord): Promise<void> {
  await adminDb.collection('custom_domains').doc(domain.domainId).set(domain, { merge: true });
}

export async function deleteDomain(domainId: string): Promise<void> {
  await adminDb.collection('custom_domains').doc(domainId).delete();
}

function publicSiteData(
  profileDocument: FirebaseFirestore.DocumentSnapshot,
  siteDocument: FirebaseFirestore.DocumentSnapshot,
  cleanHandle: string
): Record<string, unknown> {
  const siteData = siteDocument.data() || {};
  const normalizedSite = canonicalSiteToLegacy(normalizeSiteContent(siteData));
  const { webhookUrl: _webhookUrl, ga4Id: _ga4Id, metaPixelId: _metaPixelId, ...publicSiteData } = normalizedSite;
  return {
    ...publicSiteData,
    userId: profileDocument.id,
    handle: cleanHandle,
    searchIndexing: profileDocument.data()?.privacyPreferences?.searchIndexing !== false,
    analyticsCollection: profileDocument.data()?.privacyPreferences?.analyticsCollection !== false
  };
}

export async function getPublishedSiteById(userId: string, siteId: string): Promise<Record<string, unknown> | null> {
  if (!userId || !siteId) return null;
  const profileDocument = await adminDb.collection('users').doc(userId).get();
  if (!profileDocument.exists || profileDocument.data()?.privacyPreferences?.profilePublished === false) return null;
  const siteDocument = await adminDb.collection('users').doc(userId).collection('sites').doc(siteId).get();
  if (!siteDocument.exists || siteDocument.data()?.isPublished !== true) return null;
  const cleanHandle = normalizeSiteSlug(siteDocument.data()?.username);
  return validateSiteSlug(cleanHandle).valid ? publicSiteData(profileDocument, siteDocument, cleanHandle) : null;
}

export async function getPublishedSiteByHandle(handle: string, siteId?: string): Promise<Record<string, unknown> | null> {
  const cleanHandle = normalizeSiteSlug(handle);
  if (!cleanHandle) return null;
  let siteDocument: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot | null = null;
  let profileDocument: FirebaseFirestore.DocumentSnapshot | null = null;
  if (siteId) {
    const siteSnapshot = await adminDb.collectionGroup('sites').where('username', '==', cleanHandle).limit(100).get();
    siteDocument = siteSnapshot.docs.find((document) => document.id === siteId) || null;
    const ownerId = siteDocument?.ref.parent.parent?.id;
    if (ownerId) profileDocument = await adminDb.collection('users').doc(ownerId).get();
  } else {
    const siteSnapshot = await adminDb.collectionGroup('sites').where('username', '==', cleanHandle).limit(100).get();
    siteDocument = siteSnapshot.docs.find((document) => document.data()?.isPublished === true) || null;
    const ownerId = siteDocument?.ref.parent.parent?.id;
    if (ownerId) profileDocument = await adminDb.collection('users').doc(ownerId).get();
  }
  if (!profileDocument || !siteDocument?.exists || siteDocument.data()?.isPublished !== true) return null;
  if (profileDocument.data()?.privacyPreferences?.profilePublished === false) return null;
  return publicSiteData(profileDocument, siteDocument, cleanHandle);
}

export interface SiteSlugRedirect {
  oldSlug: string;
  newSlug: string;
  siteId: string;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function findSiteSlugRedirect(slug: string): Promise<SiteSlugRedirect | null> {
  const cleanSlug = normalizeSiteSlug(slug);
  if (!validateSiteSlug(cleanSlug).valid) return null;
  const snapshot = await adminDb.collection('site_slug_redirects').doc(cleanSlug).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data() || {};
  const redirect = {
    oldSlug: cleanSlug,
    newSlug: normalizeSiteSlug(data.newSlug),
    siteId: String(data.siteId || ''),
    userId: String(data.userId || ''),
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : undefined,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined
  } satisfies SiteSlugRedirect;
  return redirect.newSlug && redirect.siteId && redirect.userId ? redirect : null;
}

export async function resolveSiteSlugRedirect(slug: string): Promise<{ requestedSlug: string; canonicalSlug: string; siteId: string; userId: string } | null> {
  const requestedSlug = normalizeSiteSlug(slug);
  let current = requestedSlug;
  const seen = new Set<string>();
  for (let index = 0; index < 5; index += 1) {
    if (seen.has(current)) return null;
    seen.add(current);
    const redirect = await findSiteSlugRedirect(current);
    if (!redirect) return current === requestedSlug ? null : { requestedSlug, canonicalSlug: current, siteId: '', userId: '' };
    current = redirect.newSlug;
    if (current === requestedSlug) return null;
    if (index === 4) return null;
    const target = await getPublishedSiteByHandle(current);
    if (target) return { requestedSlug, canonicalSlug: current, siteId: redirect.siteId, userId: redirect.userId };
  }
  return null;
}

export async function getCheckoutSessionStatus(uid: string, sessionId: string): Promise<{
  status: string;
  paymentStatus: string | null;
  subscriptionId: string | null;
  customerId: string | null;
} | null> {
  if (!stripe) throw new Error('STRIPE_NOT_CONFIGURED');
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.metadata?.uid !== uid) return null;
  return {
    status: session.status || 'unknown',
    paymentStatus: session.payment_status || null,
    subscriptionId: typeof session.subscription === 'string' ? session.subscription : null,
    customerId: typeof session.customer === 'string' ? session.customer : null
  };
}

export type AuthoritativeBillingState = {
  plan: 'free' | 'pro' | 'studio';
  effectivePlan: 'free' | 'pro' | 'studio';
  interval: 'monthly' | 'yearly' | 'unknown';
  state: 'free' | 'trial' | 'active' | 'grace_period' | 'past_due' | 'cancellation_scheduled' | 'subscription_ending' | 'pending' | 'failed_payment' | 'canceled';
  stripeStatus: string;
  renewalDate: string | null;
  trialEndsAt: string | null;
  cancellationDate: string | null;
  cancelAtPeriodEnd: boolean;
  customerId: string | null;
  subscriptionId: string | null;
  source: 'stripe' | 'account';
};

function subscriptionPlan(subscription: Stripe.Subscription): 'free' | 'pro' | 'studio' {
  const metadataPlan = subscription.metadata?.plan;
  if (metadataPlan === 'studio' || metadataPlan === 'pro') return metadataPlan;
  const priceId = subscription.items.data[0]?.price?.id;
  if (priceId && priceId === getPriceId('studio', subscription.items.data[0]?.price?.recurring?.interval === 'year')) return 'studio';
  if (priceId && priceId === getPriceId('pro', subscription.items.data[0]?.price?.recurring?.interval === 'year')) return 'pro';
  return 'free';
}

function subscriptionInterval(subscription: Stripe.Subscription): 'monthly' | 'yearly' | 'unknown' {
  const interval = subscription.items.data[0]?.price?.recurring?.interval;
  return interval === 'year' ? 'yearly' : interval === 'month' ? 'monthly' : 'unknown';
}

function subscriptionCurrentPeriodEnd(subscription: Stripe.Subscription): number {
  // Stripe moved the period fields onto SubscriptionItem in newer API typings.
  return Number((subscription.items.data[0] as Stripe.SubscriptionItem & { current_period_end?: number } | undefined)?.current_period_end || 0);
}

export function normalizedSubscriptionState(subscription: Stripe.Subscription): AuthoritativeBillingState['state'] {
  const periodEnd = subscriptionCurrentPeriodEnd(subscription) * 1000;
  const cancellationScheduled = Boolean(subscription.cancel_at_period_end || (subscription.cancel_at && subscription.cancel_at * 1000 > Date.now()));
  if (subscription.status === 'trialing') return 'trial';
  if (subscription.status === 'active' && cancellationScheduled) return 'subscription_ending';
  if (subscription.status === 'active') return 'active';
  if (subscription.status === 'past_due') return periodEnd > Date.now() ? 'grace_period' : 'past_due';
  if (subscription.status === 'incomplete' || subscription.status === 'paused') return 'pending';
  if (subscription.status === 'unpaid' || subscription.status === 'incomplete_expired') return 'failed_payment';
  if (subscription.status === 'canceled') return 'canceled';
  return 'pending';
}

export async function getAuthoritativeBillingState(uid: string): Promise<AuthoritativeBillingState> {
  const userSnapshot = await adminDb.collection('users').doc(uid).get();
  const account = userSnapshot.data() || {};
  const customerId = typeof account.stripeCustomerId === 'string' ? account.stripeCustomerId : null;

  if (stripe && customerId) {
    const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 });
    const orderedSubscriptions = subscriptions.data.sort((a, b) => Number(b.created || 0) - Number(a.created || 0));
    const subscription = orderedSubscriptions.find((item) => item.status !== 'canceled') || orderedSubscriptions[0];
    if (subscription) {
      const plan = subscriptionPlan(subscription);
      const state = normalizedSubscriptionState(subscription);
      const paidEntitlementStates = new Set(['trial', 'active', 'grace_period', 'cancellation_scheduled', 'subscription_ending']);
      const effectivePlan = paidEntitlementStates.has(state) ? plan : 'free';
      const currentPeriodEnd = subscriptionCurrentPeriodEnd(subscription);
      const cancellationDate = subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : (subscription.cancel_at_period_end && currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null);
      const observed = {
        plan: effectivePlan,
        isYearly: subscriptionInterval(subscription) === 'yearly',
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        subscriptionPriceId: subscription.items.data[0]?.price?.id || null,
        billingStatus: subscription.status,
        subscriptionCurrentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
        subscriptionTrialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        subscriptionCancelAt: cancellationDate,
        subscriptionCancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
        billingState: state
      };
      await updateUserBilling(uid, observed);
      return {
        plan,
        effectivePlan,
        interval: subscriptionInterval(subscription),
        state,
        stripeStatus: subscription.status,
        renewalDate: observed.subscriptionCurrentPeriodEnd,
        trialEndsAt: observed.subscriptionTrialEnd,
        cancellationDate,
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
        customerId,
        subscriptionId: subscription.id,
        source: 'stripe'
      };
    }
  }

  const storedPlan = account.plan === 'studio' ? 'studio' : account.plan === 'pro' ? 'pro' : 'free';
  const referralActive = storedPlan === 'pro' && typeof account.referralProUntil === 'string' && Date.parse(account.referralProUntil) > Date.now() && !account.stripeSubscriptionId;
  const effectivePlan = referralActive || !stripe ? storedPlan : 'free';
  const state = effectivePlan === 'free' && !referralActive ? 'free' : 'active';
  return {
    plan: effectivePlan,
    effectivePlan,
    interval: account.isYearly ? 'yearly' : 'monthly',
    state,
    stripeStatus: typeof account.billingStatus === 'string' ? account.billingStatus : 'free',
    renewalDate: typeof account.subscriptionCurrentPeriodEnd === 'string' ? account.subscriptionCurrentPeriodEnd : null,
    trialEndsAt: typeof account.subscriptionTrialEnd === 'string' ? account.subscriptionTrialEnd : null,
    cancellationDate: typeof account.subscriptionCancelAt === 'string' ? account.subscriptionCancelAt : null,
    cancelAtPeriodEnd: Boolean(account.subscriptionCancelAtPeriodEnd),
    customerId,
    subscriptionId: typeof account.stripeSubscriptionId === 'string' ? account.stripeSubscriptionId : null,
    source: 'account'
  };
}

export async function reconcileStripeBillingState(limit = 100): Promise<number> {
  if (!stripe || !isAdminConfigured()) return 0;
  const users = await adminDb.collection('users').limit(Math.min(Math.max(limit, 1), 500)).get();
  let reconciled = 0;
  for (const user of users.docs) {
    if (typeof user.data()?.stripeCustomerId !== 'string') continue;
    const run = adminDb.collection('billing_reconciliation_runs').doc();
    await run.set({ provider: 'stripe', userId: user.id, providerCustomerId: user.data()?.stripeCustomerId, status: 'started', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    try {
      const state = await getAuthoritativeBillingState(user.id);
      await run.set({ status: 'completed', providerSubscriptionId: state.subscriptionId, observedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true });
      reconciled += 1;
    } catch (error) {
      await run.set({ status: 'failed', errorMessage: error instanceof Error ? error.message : 'BILLING_RECONCILIATION_FAILED', updatedAt: new Date().toISOString() }, { merge: true }).catch(() => undefined);
    }
  }
  return reconciled;
}

export function getCloudflareConfig(): { apiToken: string; zoneId: string } | null {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  return apiToken && zoneId ? { apiToken, zoneId } : null;
}

export async function cloudflareRequest(path: string, init: RequestInit = {}): Promise<any> {
  const config = getCloudflareConfig();
  if (!config) throw new Error('CLOUDFLARE_NOT_CONFIGURED');
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    signal: init.signal || AbortSignal.timeout(10000),
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
  const body = await response.json();
  if (!response.ok || body.success === false) {
    throw new Error(body.errors?.[0]?.message || `Cloudflare request failed with ${response.status}`);
  }
  return body.result;
}

export async function createCheckoutSession(
  user: AuthenticatedUser,
  plan: 'pro' | 'studio',
  isYearly: boolean,
  requestId?: string
): Promise<string> {
  if (!stripe) throw new Error('STRIPE_NOT_CONFIGURED');
  const price = getPriceId(plan, isYearly);
  if (!price) throw new Error('STRIPE_PRICE_NOT_CONFIGURED');

  const userSnapshot = await adminDb.collection('users').doc(user.uid).get();
  let customerId = userSnapshot.data()?.stripeCustomerId as string | undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { uid: user.uid }
    }, { idempotencyKey: `customer_${user.uid}` });
    customerId = customer.id;
    await updateUserBilling(user.uid, { stripeCustomerId: customerId });
  }

  const activeSubscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 10
  });
  const existingSubscription = activeSubscriptions.data.find((subscription) =>
    ['active', 'trialing', 'past_due', 'incomplete'].includes(subscription.status)
  );
  if (existingSubscription) throw new Error('STRIPE_SUBSCRIPTION_EXISTS');

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    customer: customerId,
    success_url: `${APP_URL}/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/pricing?checkout=cancelled`,
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    subscription_data: {
      metadata: { uid: user.uid, plan, isYearly: String(isYearly) }
    },
    metadata: { uid: user.uid, plan, isYearly: String(isYearly) }
  }, { idempotencyKey: requestId || `checkout_${user.uid}_${plan}_${isYearly ? 'yearly' : 'monthly'}_${Math.floor(Date.now() / 60000)}` });

  if (!session.url) throw new Error('STRIPE_CHECKOUT_URL_MISSING');
  return session.url;
}

export async function createPortalSession(uid: string): Promise<string> {
  if (!stripe) throw new Error('STRIPE_NOT_CONFIGURED');
  const user = await adminDb.collection('users').doc(uid).get();
  const customerId = user.data()?.stripeCustomerId;
  if (!customerId) throw new Error('STRIPE_CUSTOMER_NOT_FOUND');

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${APP_URL}/studio`
  });
  return session.url;
}

export async function reconcileCreatorOrderFromCheckout(
  orderId: string,
  session: Stripe.Checkout.Session,
  outcome: 'paid' | 'cancelled' | 'payment_failed' | 'pending_payment'
): Promise<void> {
  if (!isAdminConfigured()) return;
  const orderRef = adminDb.collection('orders').doc(orderId);
  await adminDb.runTransaction(async (transaction) => {
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists) return;
    const order = orderSnapshot.data() || {};
    const currentStatus = String(order.status || 'pending_payment');
    if (currentStatus === 'paid' || currentStatus === 'refunded') return;
    const currentState = legacyOrderState(order.state, order.fulfillmentStatus || currentStatus);
    const targetState: OrderState = outcome === 'paid'
      ? 'paid'
      : outcome === 'cancelled'
        ? 'cancelled'
        : outcome === 'payment_failed'
          ? 'payment_failed'
          : 'pending';
    const transitionKey = `stripe:${session.id}:${outcome}`;
    const transitionRef = orderRef.collection('stateTransitions').doc(cryptoHash(transitionKey));
    const transitionSnapshot = await transaction.get(transitionRef);
    if (transitionSnapshot.exists) return;
    if (currentState !== targetState) assertOrderTransition(currentState, targetState);
    const productId = String(order.productId || session.metadata?.productId || '');
    const productRef = productId ? adminDb.collection('creator_products').doc(productId) : null;
    const productSnapshot = productRef ? await transaction.get(productRef) : null;
    const reservedQuantity = Math.max(0, Number(order.inventoryReservation || 0));
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      status: outcome,
      state: targetState,
      stripeCheckoutSessionId: session.id,
      updatedAt: now
    };
    if (outcome === 'pending_payment') {
      updates.status = 'pending_payment';
    } else if (outcome === 'paid') {
      updates.fulfillmentStatus = 'unfulfilled';
      updates.inventoryReservation = 0;
      if (reservedQuantity > 0 && productRef && productSnapshot?.exists) {
        const product = productSnapshot.data() || {};
        const reserved = Math.max(0, Number(product.inventoryReserved || 0) - reservedQuantity);
        const inventory = product.inventory === null || product.inventory === undefined
          ? null
          : Math.max(0, Number(product.inventory) - reservedQuantity);
        transaction.update(productRef, { inventory, inventoryReserved: reserved, updatedAt: now });
      }
    } else {
      updates.fulfillmentStatus = 'cancelled';
      updates.inventoryReservation = 0;
      if (reservedQuantity > 0 && productRef && productSnapshot?.exists) {
        const product = productSnapshot.data() || {};
        transaction.update(productRef, {
          inventoryReserved: Math.max(0, Number(product.inventoryReserved || 0) - reservedQuantity),
          updatedAt: now
        });
      }
    }
    transaction.update(orderRef, updates);
    if (currentState !== targetState) {
      transaction.create(transitionRef, {
        orderId,
        from: currentState,
        to: targetState,
        source: 'stripe_webhook',
        transitionKey,
        createdAt: now
      });
    }
  });
}

function cryptoHash(value: string): string {
  return Buffer.from(value).toString('base64url').slice(0, 100);
}

export async function getBillingDetails(uid: string): Promise<{
  invoices: Array<{ id: string; number: string | null; status: string | null; amountPaid: number; currency: string; created: number; hostedInvoiceUrl: string | null }>;
  paymentMethod: { brand: string; last4: string; expMonth: number; expYear: number } | null;
}> {
  if (!stripe) throw new Error('STRIPE_NOT_CONFIGURED');
  const user = await adminDb.collection('users').doc(uid).get();
  const customerId = user.data()?.stripeCustomerId;
  if (!customerId) return { invoices: [], paymentMethod: null };
  const [invoices, paymentMethods] = await Promise.all([
    stripe.invoices.list({ customer: customerId, limit: 20 }),
    stripe.paymentMethods.list({ customer: customerId, type: 'card' })
  ]);
  const card = paymentMethods.data[0]?.card;
  return {
    invoices: invoices.data.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
      created: invoice.created,
      hostedInvoiceUrl: invoice.hosted_invoice_url || null
    })),
    paymentMethod: card ? { brand: card.brand, last4: card.last4, expMonth: card.exp_month, expYear: card.exp_year } : null
  };
}

export async function handleStripeWebhook(payload: string | Buffer, signature: string): Promise<void> {
  if (!stripe) throw new Error('STRIPE_NOT_CONFIGURED');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET_NOT_CONFIGURED');
  const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

  if (isAdminConfigured()) {
    const eventRef = adminDb.collection('stripe_events').doc(event.id);
    const billingWebhookRef = adminDb.collection('billing_webhook_events').doc(event.id);
    let shouldProcess = true;
    await adminDb.runTransaction(async (transaction) => {
      const eventSnapshot = await transaction.get(eventRef);
      const existing = eventSnapshot.data();
      if (existing?.status === 'processed') {
        shouldProcess = false;
        return;
      }
      const receivedAt = existing?.receivedAt ? Date.parse(existing.receivedAt) : 0;
      if (existing?.status === 'processing' && receivedAt > Date.now() - 10 * 60 * 1000) {
        throw new Error('STRIPE_EVENT_IN_PROGRESS');
      }
      transaction.set(eventRef, {
        provider: 'stripe',
        providerEventId: event.id,
        type: event.type,
        eventType: event.type,
        status: 'processing',
        receivedAt: new Date().toISOString()
      }, { merge: true });
      transaction.set(billingWebhookRef, {
        provider: 'stripe',
        providerEventId: event.id,
        eventType: event.type,
        status: 'processing',
        receivedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    });
    if (!shouldProcess) return;
  }

  if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
    const session = event.data.object as Stripe.Checkout.Session;
    const uid = session.metadata?.uid;
    if (uid) {
      await updateUserBilling(uid, {
        plan: session.metadata?.plan || 'pro',
        isYearly: session.metadata?.isYearly === 'true',
        stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
        stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : null,
        billingStatus: 'active'
      });
    }
    const orderId = session.metadata?.orderId;
    if (orderId) {
      await reconcileCreatorOrderFromCheckout(orderId, session, session.payment_status === 'paid' ? 'paid' : 'pending_payment');
    }
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    if (orderId) await reconcileCreatorOrderFromCheckout(orderId, session, 'cancelled');
  }

  if (event.type === 'checkout.session.async_payment_failed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    if (orderId) await reconcileCreatorOrderFromCheckout(orderId, session, 'payment_failed');
  }

  if (event.type.startsWith('customer.subscription.')) {
    const subscription = event.data.object as Stripe.Subscription;
    const uid = subscription.metadata?.uid;
    const userDocument = uid ? null : await getUserByStripeCustomerId(String(subscription.customer));
    const resolvedUid = uid || userDocument?.id;
    if (resolvedUid) {
      const plan = subscription.metadata?.plan || 'pro';
      const state = normalizedSubscriptionState(subscription);
      const active = ['active', 'trial', 'grace_period', 'cancellation_scheduled', 'subscription_ending'].includes(state);
      const periodEnd = subscriptionCurrentPeriodEnd(subscription);
      const cancellationDate = subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : (subscription.cancel_at_period_end && periodEnd ? new Date(periodEnd * 1000).toISOString() : null);
      await updateUserBilling(resolvedUid, {
        plan: active ? plan : 'free',
        isYearly: subscription.metadata?.isYearly === 'true',
        stripeCustomerId: String(subscription.customer),
        stripeSubscriptionId: subscription.id,
        billingStatus: subscription.status,
        billingState: state,
        subscriptionPriceId: subscription.items.data[0]?.price?.id || null,
        subscriptionCurrentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        subscriptionTrialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        subscriptionCancelAt: cancellationDate,
        subscriptionCancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end)
      });
    }
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice;
    const customer = typeof invoice.customer === 'string' ? invoice.customer : '';
    const userDocument = customer ? await getUserByStripeCustomerId(customer) : null;
    if (userDocument) await updateUserBilling(userDocument.id, { billingStatus: 'past_due' });
  }

  if (isAdminConfigured()) {
    await adminDb.collection('stripe_events').doc(event.id).set({
      status: 'processed',
      processedAt: new Date().toISOString()
    }, { merge: true });
    await adminDb.collection('billing_webhook_events').doc(event.id).set({
      status: 'processed',
      processedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });
  }
}

export { APP_URL };
