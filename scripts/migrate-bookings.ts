import 'dotenv/config';
import { adminDb } from '../server-services';
import { createConfiguredPostgresDatabase } from '../server/infrastructure/postgres';
import { createFirestoreMigrationCheckpointStore, MigrationRunner } from '../server/infrastructure/migrations';
import { createFirestoreBookingsMigrationSource, createBookingsMigrationPlan, backfillBookings, reconcileBookings } from '../server/domains/bookings/migration';
import { createPostgresBookingsRepository } from '../server/infrastructure/postgres/bookings-repository';

const operation = process.argv[2] || 'backfill';
const pageSize = Math.min(Math.max(Number(process.env.BOOKING_MIGRATION_PAGE_SIZE || 100), 1), 500);

if (!['backfill', 'reconcile'].includes(operation)) throw new Error('Usage: npm run migrate:bookings -- [backfill|reconcile]');
if (!adminDb) throw new Error('FIRESTORE_NOT_CONFIGURED');

const { pool } = createConfiguredPostgresDatabase();
const source = createFirestoreBookingsMigrationSource(adminDb);
const target = createPostgresBookingsRepository(pool);
const plan = createBookingsMigrationPlan(source, target, pageSize);
const runner = new MigrationRunner(createFirestoreMigrationCheckpointStore(adminDb));

try {
  if (operation === 'backfill') {
    await backfillBookings(runner, plan);
    console.log(JSON.stringify({ event: 'bookings_backfill_completed', pageSize }));
  } else {
    const report = await reconcileBookings(runner, plan);
    console.log(JSON.stringify({ event: 'bookings_reconciliation', ...report }));
    if (!report.equivalent) process.exitCode = 2;
  }
} finally {
  await pool.end();
}
