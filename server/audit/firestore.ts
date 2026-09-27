import type { Firestore } from 'firebase-admin/firestore';
import { AuditEntry, AuditRepository } from './contracts';

export function createFirestoreAuditRepository(db: Firestore, collectionName = 'audit_log'): AuditRepository {
  return {
    async append(entry) {
      // create(), rather than set(), preserves append-only semantics if an ID is replayed.
      await db.collection(collectionName).doc(entry.id).create(entry);
    },
    async list(resourceType, resourceId, limit = 100) {
      const snapshot = await db.collection(collectionName)
        .where('resourceType', '==', resourceType)
        .where('resourceId', '==', resourceId)
        .orderBy('occurredAt', 'desc')
        .limit(Math.min(Math.max(limit, 1), 500))
        .get();
      return snapshot.docs.map((doc) => doc.data() as AuditEntry);
    }
  };
}

