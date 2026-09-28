import type { Firestore } from 'firebase-admin/firestore';
import type { BackgroundJob, BackgroundJobRepository } from './types';

function readJob(snapshot: FirebaseFirestore.DocumentSnapshot): BackgroundJob {
  return { id: snapshot.id, ...(snapshot.data() || {}) } as BackgroundJob;
}

export function createFirestoreBackgroundJobRepository(db: Firestore): BackgroundJobRepository {
  const collection = db.collection('background_jobs');
  return {
    async create(job) {
      const reference = collection.doc(job.id);
      await db.runTransaction(async (transaction) => {
        const current = await transaction.get(reference);
        if (!current.exists) transaction.create(reference, job);
      });
      const stored = await reference.get();
      return readJob(stored);
    },
    async get(id) {
      const snapshot = await collection.doc(id).get();
      return snapshot.exists ? readJob(snapshot) : null;
    },
    async claim(id, leaseUntil) {
      const reference = collection.doc(id);
      let claimed: BackgroundJob | null = null;
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists) return;
        const current = readJob(snapshot);
        const leaseExpired = !current.leaseUntil || Date.parse(current.leaseUntil) <= Date.now();
        const available = Date.parse(current.availableAt) <= Date.now();
        if (!available || !leaseExpired || ['completed', 'dead_letter'].includes(current.status)) return;
        const next = { ...current, status: 'processing' as const, attempts: current.attempts + 1, leaseUntil, updatedAt: new Date().toISOString() };
        transaction.set(reference, next, { merge: true });
        claimed = next;
      });
      return claimed;
    },
    async complete(id, completedAt) {
      const reference = collection.doc(id);
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists || snapshot.data()?.status !== 'processing') return;
        transaction.set(reference, { status: 'completed', completedAt, leaseUntil: null, updatedAt: completedAt }, { merge: true });
      });
    },
    async fail(id, failure) {
      const reference = collection.doc(id);
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists || snapshot.data()?.status !== 'processing') return;
        transaction.set(reference, { status: failure.deadLetter ? 'dead_letter' : 'retry', lastError: failure.error, availableAt: failure.availableAt || null, leaseUntil: null, deadLetteredAt: failure.deadLetter ? failure.at : null, updatedAt: failure.at }, { merge: true });
      });
    },
    async listRecoverable(now, limit) {
      const snapshot = await collection.where('status', 'in', ['pending', 'retry', 'processing']).where('availableAt', '<=', now).limit(limit).get();
      return snapshot.docs.map(readJob);
    },
    async requeue(id, availableAt, reason) {
      const reference = collection.doc(id);
      let changed = false;
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists || ['completed', 'dead_letter'].includes(String(snapshot.data()?.status))) return;
        transaction.set(reference, { status: 'retry', availableAt, leaseUntil: null, lastError: reason, updatedAt: new Date().toISOString() }, { merge: true });
        changed = true;
      });
      return changed;
    },
    async deadLetter(id, reason, at) {
      const reference = collection.doc(id);
      let changed = false;
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists || ['completed', 'dead_letter'].includes(String(snapshot.data()?.status))) return;
        transaction.set(reference, { status: 'dead_letter', lastError: reason, deadLetteredAt: at, leaseUntil: null, updatedAt: at }, { merge: true });
        changed = true;
      });
      return changed;
    },
    async countPending(now) {
      const snapshot = await collection.where('status', 'in', ['pending', 'retry', 'processing']).where('availableAt', '<=', now).limit(10000).get();
      return snapshot.size;
    }
  };
}
