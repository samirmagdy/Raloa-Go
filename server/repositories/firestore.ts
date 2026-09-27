import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { AudienceRepository, AudienceRecord, AnalyticsRollup, AnalyticsRollupsRepository, BookingRecord, BookingsRepository, IntegrationRecord, IntegrationsRepository, InventoryRecord, InventoryRepository, OrderRecord, OrdersRepository, SiteRecord, SitesRepository, SubscriptionRecord, SubscriptionsRepository } from './contracts';

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
  return { get: async (id) => { const snapshot = await collection.doc(id).get(); return snapshot.exists ? { id, ...snapshot.data() } as OrderRecord : null; }, listByCreator: (creator, limit = 100) => records<OrderRecord>(collection.where('creatorId', '==', creator).limit(limit)), listByCustomer: (email, limit = 100) => records<OrderRecord>(collection.where('customerEmail', '==', email).limit(limit)), save: async (id, order) => { await collection.doc(id).set(order, { merge: true }); } };
}

export function createFirestoreInventoryRepository(db: Firestore): InventoryRepository {
  const collection = db.collection('inventory');
  const change = async (productId: string, availableDelta: number, reservedDelta: number) => {
    await db.runTransaction(async (transaction) => {
      const reference = collection.doc(productId);
      const snapshot = await transaction.get(reference);
      const data = snapshot.data() || {};
      const available = Number(data.available || 0) + availableDelta;
      if (available < 0) throw new Error('INVENTORY_UNAVAILABLE');
      transaction.set(reference, { productId, available: FieldValue.increment(availableDelta), reserved: FieldValue.increment(reservedDelta) }, { merge: true });
    });
  };
  return { getByProduct: async (productId) => { const snapshot = await collection.doc(productId).get(); return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } as InventoryRecord : null; }, reserve: (id, quantity) => change(id, -quantity, quantity), release: (id, quantity) => change(id, quantity, -quantity), decrement: (id, quantity) => change(id, -quantity, 0) };
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
