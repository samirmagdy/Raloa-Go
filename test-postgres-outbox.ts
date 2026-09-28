import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createOutboxEvent } from './server/outbox/firestore';

const migration = fs.readFileSync('db/migrations/014_outbox_delivery_metadata.sql', 'utf8');
assert.match(migration, /event_version/);
assert.match(migration, /correlation_id/);
assert.match(migration, /outbox_event_consumers/);

const event = createOutboxEvent({
  eventType: 'OrderCreated.v1',
  aggregateType: 'order',
  aggregateId: '00000000-0000-4000-8000-000000000001',
  idempotencyKey: 'order:1:created',
  correlationId: 'checkout:1',
  payload: { orderId: '1', productId: 'p1', siteId: 's1', creatorId: 'u1' }
});
assert.equal(event.eventVersion, 1);
assert.equal(event.correlationId, 'checkout:1');
assert.equal(event.status, 'pending');
assert.equal(event.attempts, 0);
console.log('postgres outbox contract checks passed');
