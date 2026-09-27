import type { Firestore } from 'firebase-admin/firestore';
import type { FirebaseStore } from '../core/providers';

export function createFirebaseStore(db: Firestore): FirebaseStore {
  return {
    async get<T>(collection: string, id: string) {
      const snapshot = await db.collection(collection).doc(id).get();
      return snapshot.exists ? snapshot.data() as T : null;
    },
    async list<T>(collection: string, filters: Record<string, unknown> = {}, limit = 100) {
      let query: any = db.collection(collection);
      for (const [field, value] of Object.entries(filters)) query = query.where(field, '==', value);
      const snapshot = await query.limit(limit).get();
      return snapshot.docs.map((document: any) => ({ id: document.id, ...document.data() })) as T[];
    },
    async save(collection, id, value) {
      await db.collection(collection).doc(id).set(value, { merge: true });
    },
    async remove(collection, id) {
      await db.collection(collection).doc(id).delete();
    }
  };
}
