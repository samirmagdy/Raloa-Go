import crypto from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { AuthoritativeBillingState } from '../../server-services';
import { assertOrderTransition, legacyOrderState } from '../domains/orders/state-machine';
import type { MediaAsset, MediaMetadataRepository } from '../domains/media/contracts';
import { assertInventoryBalance, assertPositiveQuantity } from '../core/domain-invariants';
import type { AudienceRepository, AudienceRecord, AnalyticsRollup, AnalyticsRollupsRepository, BillingRepository, BillingStateRecord, BookingRecord, BookingsRepository, DomainsRepository, FulfillmentRecord, FulfillmentsRepository, IntegrationRecord, IntegrationsRepository, InventoryRecord, InventoryRepository, OrderRecord, OrdersRepository, OrderTransitionRecord, PaymentRecord, PaymentsRepository, ProductRecord, ProductsRepository, SiteRecord, SitesRepository, SubscriptionRecord, SubscriptionsRepository } from './contracts';

async function records<T>(query: any): Promise<T[]> {
  const snapshot = await query.get();
  return snapshot.docs.map((document: any) => ({ id: document.id, ...document.data() })) as T[];
}

export function createFirestoreSitesRepository(db: Firestore): SitesRepository {
  const sites = (userId: string) => db.collection('users').doc(userId).collection('sites');
  return {
    getOwned: async (userId, siteId) => { const snapshot = await sites(userId).doc(siteId).get(); return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } as SiteRecord : null; },
    listOwned: (userId, limit = 100) => records<SiteRecord>(sites(userId).limit(limit)),
    findPublishedByHandle: async (handle, siteId) => { const matches = await records<SiteRecord>(db.collectionGroup('sites').where('username', '==', handle).where('isPublished', '==', true).limit(100)); return matches.find((site) => !siteId || site.id === siteId) || null; },
    save: async (siteId, site) => { const userId = String(site.userId || ''); await sites(userId).doc(siteId).set(site, { merge: true }); },
    remove: async (userId, siteId) => { await sites(userId).doc(siteId).delete(); }
  };
}

export function createFirestoreBookingsRepository(db: Firestore): BookingsRepository {
  const collection = db.collection('bookings');
  return { get: async (id) => { const snapshot = await collection.doc(id).get(); return snapshot.exists ? { id, ...snapshot.data() } as BookingRecord : null; }, listForHost: (host, site, limit = 100) => records<BookingRecord>((site ? collection.where('siteId', '==', site) : collection).where('hostUserId', '==', host).limit(limit)), create: async (id, booking) => { await collection.doc(id).create(booking); }, update: async (id, changes) => { await collection.doc(id).set(changes, { merge: true }); } };
}

export function createFirestoreOrdersRepository(db: Firestore): OrdersRepository {
  const collection = db.collection('orders');
  return {
    get: async (id) => { const snapshot = await collection.doc(id).get(); return snapshot.exists ? { id, ...snapshot.data() } as OrderRecord : null; },
    listByCreator: (creator, limit = 100) => records<OrderRecord>(collection.where('creatorId', '==', creator).limit(limit)),
    listByCustomer: (email, limit = 100) => records<OrderRecord>(collection.where('customerEmail', '==', email).limit(limit)),
    save: async (id, order) => { await collection.doc(id).set(order, { merge: true }); },
    transition: async (id, transition: OrderTransitionRecord) => db.runTransaction(async (transaction) => {
      const reference = collection.doc(id);
      const transitionId = crypto.createHash('sha256').update(transition.transitionKey).digest('hex');
      const historyReference = reference.collection('stateTransitions').doc(transitionId);
      const snapshot = await transaction.get(reference);
      const history = await transaction.get(historyReference);
      if (!snapshot.exists) throw new Error('ORDER_NOT_FOUND');
      if (history.exists) return { id, ...snapshot.data() } as OrderRecord;
      const current = legacyOrderState(snapshot.data()?.state, snapshot.data()?.fulfillmentStatus || snapshot.data()?.status);
      if (current !== transition.from) throw new Error(`STALE_ORDER_STATE:${current}`);
      assertOrderTransition(current, transition.to as any);
      const now = new Date().toISOString();
      transaction.update(reference, { state: transition.to, updatedAt: now });
      transaction.create(historyReference, { ...transition, createdAt: now });
      return { id, ...snapshot.data(), state: transition.to, updatedAt: now } as OrderRecord;
    })
  };
}

export function createFirestoreProductsRepository(db: Firestore): ProductsRepository {
  const collection = db.collection('creator_products');
  return {
    get: async (id) => { const snapshot = await collection.doc(id).get(); return snapshot.exists ? { id, ...snapshot.data() } as ProductRecord : null; },
    listForSite: (siteId, creatorId, limit = 100) => records<ProductRecord>((creatorId ? collection.where('creatorId', '==', creatorId) : collection).where('siteId', '==', siteId).limit(limit)),
    save: async (id, product) => { await collection.doc(id).set(product, { merge: true }); },
    remove: async (id) => { await collection.doc(id).delete(); }
  };
}

export function createFirestorePaymentsRepository(db: Firestore): PaymentsRepository {
  const collection = db.collection('payments');
  return {
    get: async (id) => { const snapshot = await collection.doc(id).get(); return snapshot.exists ? { id, ...snapshot.data() } as PaymentRecord : null; },
    getByProviderEvent: async (provider, providerEventId) => { const snapshot = await collection.where('provider', '==', provider).where('providerEventId', '==', providerEventId).limit(1).get(); const document = snapshot.docs[0]; return document ? { id: document.id, ...document.data() } as PaymentRecord : null; },
    save: async (id, payment) => { await collection.doc(id).set(payment, { merge: true }); }
  };
}

export function createFirestoreFulfillmentsRepository(db: Firestore): FulfillmentsRepository {
  const collection = db.collection('fulfillments');
  return {
    getByOrder: async (orderId) => { const snapshot = await collection.where('orderId', '==', orderId).limit(1).get(); const document = snapshot.docs[0]; return document ? { id: document.id, ...document.data() } as FulfillmentRecord : null; },
    save: async (orderId, fulfillment) => { await collection.doc(orderId).set({ orderId, ...fulfillment }, { merge: true }); }
  };
}

export function createFirestoreInventoryRepository(db: Firestore): InventoryRepository {
  const collection = db.collection('inventory');
  const change = async (productId: string, quantity: number, operation: 'reserve' | 'release' | 'decrement') => {
    assertPositiveQuantity(quantity);
    await db.runTransaction(async (transaction) => {
      const reference = collection.doc(productId);
      const snapshot = await transaction.get(reference);
      const data = snapshot.data() || {};
      const currentAvailable = Number(data.available || 0);
      const currentReserved = Number(data.reserved || 0);
      assertInventoryBalance(currentAvailable, currentReserved, quantity, operation);
      const availableDelta = operation === 'release' ? quantity : -quantity;
      const reservedDelta = operation === 'reserve' ? quantity : operation === 'release' ? -quantity : 0;
      transaction.set(reference, { productId, available: FieldValue.increment(availableDelta), reserved: FieldValue.increment(reservedDelta) }, { merge: true });
    });
  };
  return { getByProduct: async (productId) => { const snapshot = await collection.doc(productId).get(); return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } as InventoryRecord : null; }, reserve: (id, quantity) => change(id, quantity, 'reserve'), release: (id, quantity) => change(id, quantity, 'release'), decrement: (id, quantity) => change(id, quantity, 'decrement') };
}

export function createFirestoreSubscriptionsRepository(db: Firestore): SubscriptionsRepository {
  const collection = db.collection('users');
  return { getByUser: async (userId) => { const snapshot = await collection.doc(userId).get(); return snapshot.exists ? { id: userId, userId, ...snapshot.data() } as SubscriptionRecord : null; }, save: async (userId, subscription) => { await collection.doc(userId).set({ userId, ...subscription }, { merge: true }); } };
}

export function createFirestoreIntegrationsRepository(db: Firestore): IntegrationsRepository {
  const collection = db.collection('creator_integrations');
  return { listForUser: (userId) => records<IntegrationRecord>(collection.where('userId', '==', userId)), get: async (userId, provider) => { const snapshot = await collection.doc(`${userId}_${provider}`).get(); return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } as IntegrationRecord : null; }, save: async (userId, provider, integration) => { await collection.doc(`${userId}_${provider}`).set(integration, { merge: true }); }, remove: async (userId, provider) => { await collection.doc(`${userId}_${provider}`).delete(); } };
}

export function createFirestoreAudienceRepository(db: Firestore): AudienceRepository {
  const collection = (kind: 'subscriber' | 'submission') => db.collection(kind === 'subscriber' ? 'audience_subscribers' : 'audience_submissions');
  return { list: (userId, siteId, limit = 100) => records<AudienceRecord>((siteId ? collection('subscriber').where('siteId', '==', siteId) : collection('subscriber')).where('userId', '==', userId).limit(limit)), get: async (kind, id) => { const snapshot = await collection(kind).doc(id).get(); return snapshot.exists ? { id, ...snapshot.data() } as AudienceRecord : null; }, save: async (kind, id, record) => { await collection(kind).doc(id).set(record, { merge: true }); }, remove: async (kind, id) => { await collection(kind).doc(id).delete(); } };
}

export function createFirestoreAnalyticsRollupsRepository(db: Firestore): AnalyticsRollupsRepository {
  const query = (collection: string, owner: string, siteId?: string, fromDate?: string, toDate?: string) => { let result: any = db.collection(collection).where('siteOwnerId', '==', owner); if (siteId) result = result.where('siteId', '==', siteId); if (fromDate) result = result.where('date', '>=', fromDate); if (toDate) result = result.where('date', '<=', toDate); return result; };
  return { saveRollup: async (key, rollup) => { await db.collection('analytics_rollups').doc(key).set(rollup, { merge: true }); }, listRollups: (owner, site, from, to) => records<AnalyticsRollup>(query('analytics_rollups', owner, site, from, to)), listVisitorDays: (owner, site, from, to) => records<AnalyticsRollup>(query('analytics_visitor_days', owner, site, from, to)) };
}

export function createFirestoreBillingRepository(db: Firestore, authoritativeLoader?: (accountId: string) => Promise<AuthoritativeBillingState | null>): BillingRepository {
  const collection = db.collection('users');
  return {
    async getAuthoritativeState(accountId) {
      const loaded = authoritativeLoader ? await authoritativeLoader(accountId) : null;
      if (loaded) return { ...loaded, accountId };
      const snapshot = await collection.doc(accountId).get();
      if (!snapshot.exists) return null;
      const data = snapshot.data() || {};
      const plan = data.plan === 'studio' || data.plan === 'pro' ? data.plan : 'free';
      const billingState: AuthoritativeBillingState['state'] = ['free', 'trial', 'active', 'grace_period', 'past_due', 'cancellation_scheduled', 'subscription_ending', 'pending', 'failed_payment', 'canceled'].includes(String(data.billingState))
        ? data.billingState
        : plan === 'free' ? 'free' : 'active';
      return {
        accountId,
        plan,
        effectivePlan: plan,
        interval: data.isYearly === true ? 'yearly' : 'monthly',
        state: billingState,
        stripeStatus: typeof data.billingStatus === 'string' ? data.billingStatus : 'free',
        renewalDate: typeof data.subscriptionCurrentPeriodEnd === 'string' ? data.subscriptionCurrentPeriodEnd : null,
        trialEndsAt: typeof data.subscriptionTrialEnd === 'string' ? data.subscriptionTrialEnd : null,
        cancellationDate: typeof data.subscriptionCancelAt === 'string' ? data.subscriptionCancelAt : null,
        cancelAtPeriodEnd: data.subscriptionCancelAtPeriodEnd === true,
        customerId: typeof data.stripeCustomerId === 'string' ? data.stripeCustomerId : null,
        subscriptionId: typeof data.stripeSubscriptionId === 'string' ? data.stripeSubscriptionId : null,
        source: 'account'
      };
    },
    async saveAuthoritativeState(accountId, state) {
      await collection.doc(accountId).set({
        plan: state.plan,
        isYearly: state.interval === 'yearly',
        stripeCustomerId: state.customerId,
        stripeSubscriptionId: state.subscriptionId,
        billingStatus: state.stripeStatus,
        billingState: state.state,
        subscriptionCurrentPeriodEnd: state.renewalDate,
        subscriptionTrialEnd: state.trialEndsAt,
        subscriptionCancelAt: state.cancellationDate,
        subscriptionCancelAtPeriodEnd: state.cancelAtPeriodEnd,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
  };
}

export function createFirestoreDomainsRepository(db: Firestore): DomainsRepository {
  const collection = db.collection('custom_domains');
  return {
    get: async (id) => { const snapshot = await collection.doc(id).get(); return snapshot.exists ? { id, ...snapshot.data() } : null; },
    findByHostname: async (hostname) => { const snapshot = await collection.where('hostname', '==', hostname).limit(1).get(); const document = snapshot.docs[0]; return document ? { id: document.id, ...document.data() } : null; },
    findByIdempotencyKey: async (key) => { const snapshot = await collection.where('idempotencyKey', '==', key).limit(1).get(); const document = snapshot.docs[0]; return document ? { id: document.id, ...document.data() } : null; },
    listOwned: (ownerUserId) => records<Record<string, unknown>>(collection.where('userId', '==', ownerUserId).limit(100)),
    save: async (id, domain) => { await collection.doc(id).set(domain, { merge: true }); },
    remove: async (id) => { await collection.doc(id).delete(); }
  };
}

export function createFirestoreMediaMetadataRepository(db: Firestore): MediaMetadataRepository {
  const collection = db.collection('media_assets');
  const read = (document: any): MediaAsset => {
    const data = document.data() || {};
    return {
      ...data,
      id: document.id,
      ownerUserId: String(data.ownerUserId || data.userId || ''),
      siteId: String(data.siteId || ''),
      lifecycle: data.lifecycle || (data.status === 'ready' ? 'ready' : data.status === 'deleted' ? 'deleted' : 'uploaded'),
      original: data.original || { provider: 'firebase_storage', objectKey: String(data.originalPath || ''), contentType: String(data.mimeType || data.sourceMimeType || 'application/octet-stream'), bytes: Number(data.sourceBytes || data.bytes || 0), cdnUrl: data.publicUrl },
      createdAt: String(data.createdAt || new Date(0).toISOString()),
      updatedAt: String(data.updatedAt || data.createdAt || new Date(0).toISOString())
    } as MediaAsset;
  };
  return {
    create: async (asset) => { await collection.doc(asset.id).create(asset); },
    get: async (id) => { const snapshot = await collection.doc(id).get(); return snapshot.exists ? read(snapshot) : null; },
    listOwned: async (ownerUserId, siteId) => { const snapshot = await collection.where('siteId', '==', siteId).where('userId', '==', ownerUserId).limit(500).get(); return snapshot.docs.map(read); },
    listAll: async () => { const snapshot = await collection.limit(5000).get(); return snapshot.docs.map(read); },
    listAbandoned: async (cutoff) => { const snapshot = await collection.where('createdAt', '<', cutoff).where('status', 'in', ['pending_upload', 'uploaded', 'processing']).limit(500).get(); return snapshot.docs.map(read); },
    remove: async (id) => { await collection.doc(id).delete(); },
    update: async (id, changes) => { await collection.doc(id).set(changes, { merge: true }); const snapshot = await collection.doc(id).get(); if (!snapshot.exists) throw new Error('MEDIA_NOT_FOUND'); return read(snapshot); }
  };
}
