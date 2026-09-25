import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import Stripe from 'stripe';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0319129908';
const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'ai-studio-raloadesignfirst-8ccbe7ea-5af1-4106-809a-71252bddde6f';
const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const adminApp = getApps().length ? getApps()[0] : initializeApp({ projectId: PROJECT_ID });
export const adminDb = getFirestore(adminApp, DATABASE_ID);
export const adminAuth = getAdminAuth(adminApp);

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
  verificationToken: string;
  verificationStatus: 'pending' | 'verified' | 'failed';
  sslStatus: 'pending' | 'active' | 'failed';
  dnsRecords?: Array<{ type: 'CNAME' | 'A' | 'TXT'; name: string; value: string; is_verified: boolean }>;
  cloudflareHostnameId?: string;
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

export async function getPublishedSiteByHandle(handle: string): Promise<Record<string, unknown> | null> {
  const cleanHandle = handle.trim().toLowerCase();
  if (!cleanHandle) return null;

  const profileSnapshot = await adminDb.collection('users')
    .where('handle', '==', cleanHandle)
    .limit(1)
    .get();
  const profileDocument = profileSnapshot.docs[0];
  if (!profileDocument) return null;
  if (profileDocument.data()?.privacyPreferences?.profilePublished === false) return null;

  const siteDocument = await adminDb.collection('users')
    .doc(profileDocument.id)
    .collection('sites')
    .doc('default')
    .get();
  if (!siteDocument.exists || siteDocument.data()?.isPublished !== true) return null;

  return {
    ...siteDocument.data(),
    userId: profileDocument.id,
    handle: cleanHandle,
    searchIndexing: profileDocument.data()?.privacyPreferences?.searchIndexing !== false,
    analyticsCollection: profileDocument.data()?.privacyPreferences?.analyticsCollection !== false
  };
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
        type: event.type,
        status: 'processing',
        receivedAt: new Date().toISOString()
      }, { merge: true });
    });
    if (!shouldProcess) return;
  }

  if (event.type === 'checkout.session.completed') {
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
  }

  if (event.type.startsWith('customer.subscription.')) {
    const subscription = event.data.object as Stripe.Subscription;
    const uid = subscription.metadata?.uid;
    const userDocument = uid ? null : await getUserByStripeCustomerId(String(subscription.customer));
    const resolvedUid = uid || userDocument?.id;
    if (resolvedUid) {
      const plan = subscription.metadata?.plan || 'pro';
      const active = ['active', 'trialing'].includes(subscription.status);
      await updateUserBilling(resolvedUid, {
        plan: active ? plan : 'free',
        isYearly: subscription.metadata?.isYearly === 'true',
        stripeCustomerId: String(subscription.customer),
        stripeSubscriptionId: subscription.id,
        billingStatus: subscription.status
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
  }
}

export { APP_URL };
