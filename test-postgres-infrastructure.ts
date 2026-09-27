import assert from 'node:assert/strict';
import { outboxEvents, bookings } from './server/infrastructure/postgres/schema';
import { withPostgresTransaction } from './server/infrastructure/postgres/client';

assert.equal(outboxEvents.idempotencyKey.name, 'idempotency_key');
assert.equal(bookings.status.name, 'status');
assert.equal(typeof withPostgresTransaction, 'function');
console.log('PostgreSQL persistence boundary tests passed');
