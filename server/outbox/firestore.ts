import type { Firestore, Transaction } from 'firebase-admin/firestore';
import type { DomainEventName, DomainEventType } from '../events';
import { eventType } from '../events';
import type { OutboxEvent, OutboxRepository } from './types';

export function createOutboxEvent(input: Pick<OutboxEvent, 'id' | 'aggregateType' | 'aggregateId' | 'idempotencyKey' | 'payload'> & { eventType: DomainEventType | DomainEventName } & Partial<Pick<OutboxEvent, 'maxAttempts' | 'availableAt'>>): OutboxEvent {
  const now = new Date().toISOString();
  const [name, version] = input.eventType.split('.v');
  return { ...input, eventType: eventType(name as DomainEventName, Number(version || 1)), maxAttempts: input.maxAttempts || 8, availableAt: input.availableAt || now, status: 'pending', attempts: 0, createdAt: now, updatedAt: now };
}

export function appendOutboxEvent(transaction: Transaction, db: Firestore, event: OutboxEvent): void {
  transaction.create(db.collection('outbox_events').doc(event.id), event);
}

function read(snapshot: FirebaseFirestore.DocumentSnapshot): OutboxEvent {
  return { id: snapshot.id, ...(snapshot.data() || {}) } as OutboxEvent;
}

export function createFirestoreOutboxRepository(db: Firestore): OutboxRepository {
  const collection = db.collection('outbox_events');
  return {
    async listDue(now, limit) {
      const snapshot = await collection.where('status', 'in', ['pending', 'retry', 'publishing']).where('availableAt', '<=', now).limit(limit).get();
      return snapshot.docs.map(read);
    },
    async claim(id, leaseUntil) {
      const reference = collection.doc(id);
      let claimed: OutboxEvent | null = null;
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists) return;
        const current = read(snapshot);
        const available = Date.parse(current.availableAt) <= Date.now();
        const leaseExpired = !current.leaseUntil || Date.parse(current.leaseUntil) <= Date.now();
        if (!available || !leaseExpired || ['published', 'dead_letter'].includes(current.status)) return;
        claimed = { ...current, status: 'publishing', attempts: current.attempts + 1, leaseUntil, updatedAt: new Date().toISOString() };
        transaction.set(reference, claimed, { merge: true });
      });
      return claimed;
    },
    async markPublished(id, publishedAt) {
      await db.runTransaction(async (transaction) => {
        const reference = collection.doc(id);
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists || snapshot.data()?.status !== 'publishing') return;
        transaction.set(reference, { status: 'published', publishedAt, leaseUntil: null, updatedAt: publishedAt }, { merge: true });
      });
    },
    async markFailed(id, error, availableAt, deadLetter) {
      await db.runTransaction(async (transaction) => {
        const reference = collection.doc(id);
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists || snapshot.data()?.status !== 'publishing') return;
        const now = new Date().toISOString();
        transaction.set(reference, { status: deadLetter ? 'dead_letter' : 'retry', lastError: error, availableAt: availableAt || null, leaseUntil: null, updatedAt: now }, { merge: true });
      });
    }
  };
}
