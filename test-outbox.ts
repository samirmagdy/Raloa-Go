import assert from 'node:assert/strict';
import { createOutboxEvent } from './server/outbox/firestore';
import { createOutboxService } from './server/outbox/service';
import type { OutboxEvent, OutboxPublisher, OutboxRepository } from './server/outbox/types';

class MemoryOutbox implements OutboxRepository {
  events = new Map<string, OutboxEvent>();
  async listDue() { return [...this.events.values()].filter((event) => ['pending', 'retry', 'publishing'].includes(event.status)); }
  async claim(id: string, leaseUntil: string) { const event = this.events.get(id); if (!event || ['published', 'dead_letter'].includes(event.status)) return null; const claimed = { ...event, status: 'publishing' as const, attempts: event.attempts + 1, leaseUntil }; this.events.set(id, claimed); return claimed; }
  async markPublished(id: string, publishedAt: string) { const event = this.events.get(id)!; this.events.set(id, { ...event, status: 'published', publishedAt }); }
  async markFailed(id: string, error: string) { const event = this.events.get(id)!; this.events.set(id, { ...event, status: 'retry', lastError: error }); }
}

const repository = new MemoryOutbox();
const published: string[] = [];
const publisher: OutboxPublisher = { publish: async (event) => { published.push(event.id); } };
const service = createOutboxService(repository, publisher);
const event = createOutboxEvent({ id: 'event-1', eventType: 'booking.created', aggregateType: 'booking', aggregateId: 'booking-1', idempotencyKey: 'booking:booking-1:created', payload: { bookingId: 'booking-1' } });
repository.events.set(event.id, event);
repository.events.set(event.id, event);
assert.equal((await service.publishPending()).published, 1);
assert.equal(published.length, 1);
assert.equal((await service.publishPending()).published, 0);
assert.equal(repository.events.get(event.id)?.status, 'published');
console.log('Outbox atomic publication and duplicate suppression tests passed');
