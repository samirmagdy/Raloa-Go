import assert from 'node:assert/strict';
import { assertBookingCutoverSafe, BookingCutoverBlockedError, verifyBookingMigration } from './server/domains/bookings/verification';
import type { BookingRecord } from './server/repositories/contracts';
import type { MigrationPlan, MigrationSource, MigrationTarget } from './server/infrastructure/migrations/types';

const records: BookingRecord[] = [
  { id: 'booking-1', siteId: 'site-1', hostUserId: 'host-1', status: 'cancelled' },
  { id: 'booking-2', siteId: 'site-1', hostUserId: 'host-1', status: 'confirmed' }
];
const source: MigrationSource<BookingRecord> = {
  async listPage(cursor, limit) { const offset = cursor ? Number(cursor) : 0; const page = records.slice(offset, offset + limit); return { records: page, nextCursor: offset + page.length < records.length ? String(offset + page.length) : null }; },
  getId: (record) => String(record.id)
};
const targetRecords = new Map(records.map((record) => [String(record.id), { ...record }]));
const target: MigrationTarget<BookingRecord> = {
  async upsert() {},
  async get(id) { return targetRecords.get(id) || null; },
  async listIds() { return [...targetRecords.keys()]; }
};
const plan: MigrationPlan<BookingRecord> = { domain: 'bookings', pageSize: 1, source, target, normalize: (record) => record, writeMode: 'shadow_write' };
let reservationClaimed = false;
const verification = await verifyBookingMigration({
  plan,
  cancelledBookingIds: ['booking-1'],
  calendarJob: async () => ({ exists: true, status: 'cancelled' }),
  concurrentReservation: async () => {
    if (reservationClaimed) throw new Error('BOOKING_SLOT_TAKEN');
    reservationClaimed = true;
    return { id: 'reservation-1' };
  }
});
assertBookingCutoverSafe(verification);
assert.equal(verification.passed, true);
assert.equal(verification.concurrency?.successes, 1);

targetRecords.set('booking-2', { ...records[1], status: 'cancelled' });
const blocked = await verifyBookingMigration({ plan });
assert.equal(blocked.passed, false);
assert.throws(() => assertBookingCutoverSafe(blocked), (error) => error instanceof BookingCutoverBlockedError);

console.log('Booking verification gate tests passed');
