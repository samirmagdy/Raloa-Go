import type { Firestore } from 'firebase-admin/firestore';
import type { MigrationCheckpoint, MigrationCheckpointStore } from './types';

export function createFirestoreMigrationCheckpointStore(db: Firestore, collectionName = 'migration_checkpoints'): MigrationCheckpointStore {
  return {
    async get(domain) {
      const snapshot = await db.collection(collectionName).doc(domain).get();
      return snapshot.exists ? snapshot.data() as MigrationCheckpoint : null;
    },
    async save(checkpoint) {
      await db.collection(collectionName).doc(checkpoint.domain).set(checkpoint, { merge: true });
    }
  };
}
