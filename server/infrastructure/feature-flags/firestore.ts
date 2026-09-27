import type { Firestore } from 'firebase-admin/firestore';
import { featureFlagStateSchema, type FeatureFlagKey, type FeatureFlagRepository, type FeatureFlagState } from './contracts';

const COLLECTION = 'feature_flags';

export function createFirestoreFeatureFlagRepository(db: Firestore): FeatureFlagRepository {
  return {
    async get(key: FeatureFlagKey) {
      const snapshot = await db.collection(COLLECTION).doc(key).get();
      return snapshot.exists ? featureFlagStateSchema.parse({ key, ...snapshot.data() }) : null;
    },
    async list() {
      const snapshot = await db.collection(COLLECTION).get();
      return snapshot.docs.map((document) => featureFlagStateSchema.parse({ key: document.id, ...document.data() }));
    },
    async save(state: FeatureFlagState) {
      await db.collection(COLLECTION).doc(state.key).set(state, { merge: true });
    }
  };
}
