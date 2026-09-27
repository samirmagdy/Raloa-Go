import type { DocumentData, Firestore, Query } from 'firebase-admin/firestore';
import type { EntityId, OwnedResourceRepository, Repository } from '../core/types';

export function firestoreRepository<T extends DocumentData>(db: Firestore, collection: string): Repository<T> {
  const ref = db.collection(collection);
  return {
    get: (id) => ref.doc(id).get() as Promise<any>,
    create: async (id, value) => { await ref.doc(id).create(value); },
    save: async (id, value) => { await ref.doc(id).set(value, { merge: true }); },
    delete: (id) => ref.doc(id).delete().then(() => undefined),
    query: () => ref as unknown as Query<T>
  };
}

export function ownedSubcollectionRepository<T extends DocumentData>(db: Firestore, collection: string): OwnedResourceRepository<T> {
  return {
    ...firestoreRepository<T>(db, collection),
    getOwned: (userId: string, id: EntityId) => db.collection('users').doc(userId).collection(collection).doc(id).get() as Promise<any>,
    listOwned: async (userId: string, limit = 100) => (await db.collection('users').doc(userId).collection(collection).limit(limit).get()).docs as any
  };
}
