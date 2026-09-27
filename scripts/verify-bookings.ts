import 'dotenv/config';
import crypto from 'node:crypto';
import { adminDb } from '../server-services';
import { createConfiguredPostgresDatabase, createPostgresBookingsRepository } from '../server/infrastructure/postgres';
import { createFirestoreMigrationCheckpointStore, MigrationRunner } from '../server/infrastructure/migrations';
import { createFirestoreBookingsMigrationSource, createBookingsMigrationPlan } from '../server/domains/bookings/migration';
import { assertBookingCutoverSafe, switchBookingsToTarget, verifyBookingMigration } from '../server/domains/bookings/verification';
import type { BookingRecord } from '../server/repositories/contracts';

const operation = process.argv[2] || 'verify';
if (!['verify', 'cutover'].includes(operation)) throw new Error('Usage: npm run verify:bookings -- [verify|cutover]');
if (!adminDb) throw new Error('FIRESTORE_NOT_CONFIGURED');

const { pool } = createConfiguredPostgresDatabase();
const target = createPostgresBookingsRepository(pool);
const source = createFirestoreBookingsMigrationSource(adminDb);
const pageSize = Math.min(Math.max(Number(process.env.BOOKING_MIGRATION_PAGE_SIZE || 100), 1), 500);
const plan = createBookingsMigrationPlan(source, target, pageSize);
const runner = new MigrationRunner(createFirestoreMigrationCheckpointStore(adminDb));
const cancelledBookingIds = String(process.env.BOOKING_VERIFY_CANCELLED_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
const successfulConcurrencyIds: string[] = [];
const shouldVerifyConcurrency = process.env.BOOKING_VERIFY_CONCURRENCY === 'true';

const concurrentReservation = shouldVerifyConcurrency ? async (): Promise<BookingRecord> => {
  const id = crypto.randomUUID();
  successfulConcurrencyIds.push(id);
  return target.reserveSlot({
    id,
    siteId: requiredEnv('BOOKING_VERIFY_SITE_ID'),
    hostUserId: requiredEnv('BOOKING_VERIFY_HOST_USER_ID'),
    serviceId: requiredEnv('BOOKING_VERIFY_SERVICE_ID'),
    slotStart: requiredEnv('BOOKING_VERIFY_SLOT_START'),
    slotEnd: requiredEnv('BOOKING_VERIFY_SLOT_END'),
    timezone: process.env.BOOKING_VERIFY_TIMEZONE || 'UTC',
    customerName: 'Booking migration concurrency verification',
    customerEmail: process.env.BOOKING_VERIFY_EMAIL || 'booking-migration-verification@example.test',
    status: 'pending_confirmation',
    idempotencyKey: `booking-verification:${id}`
  });
} : undefined;

try {
  const verification = await verifyBookingMigration({
    plan,
    cancelledBookingIds,
    concurrentReservation,
    calendarJob: async (bookingId) => {
      const snapshot = await adminDb.collection('calendar_jobs').where('bookingId', '==', bookingId).limit(1).get();
      const data = snapshot.docs[0]?.data();
      return { exists: Boolean(data), status: data?.status || null };
    }
  });
  console.log(JSON.stringify({ event: 'bookings_verification', ...verification }));
  assertBookingCutoverSafe(verification);
  if (operation === 'cutover') await switchBookingsToTarget(runner, verification);
} finally {
  for (const id of successfulConcurrencyIds) {
    try { await target.update(id, { status: 'cancelled' }); } catch { /* verification cleanup is best effort */ }
  }
  await pool.end();
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}
