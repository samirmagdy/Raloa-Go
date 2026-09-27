import type { Firestore } from 'firebase-admin/firestore';
import { MigrationRunner, type ReconciliationReport } from '../../infrastructure/migrations';
import type { BookingRecord } from '../../repositories/contracts';
import type { PostgresBookingsRepository } from '../../infrastructure/postgres/bookings-repository';
import type { MigrationPage, MigrationSource, MigrationTarget } from '../../infrastructure/migrations/types';

export function createFirestoreBookingsMigrationSource(db: Firestore): MigrationSource<BookingRecord> {
  return {
    async listPage(cursor, limit): Promise<MigrationPage<BookingRecord>> {
      let query: any = db.collection('bookings').orderBy('createdAt', 'desc').orderBy('__name__', 'desc').limit(limit);
      if (cursor) {
        const position = JSON.parse(cursor) as { createdAt: unknown; id: string };
        query = query.startAfter(position.createdAt, position.id);
      }
      const snapshot = await query.get();
      const records = snapshot.docs.map((document: any) => ({ id: document.id, ...document.data() })) as BookingRecord[];
      const last = snapshot.docs[snapshot.docs.length - 1];
      return { records, nextCursor: records.length === limit && last ? JSON.stringify({ createdAt: last.data()?.createdAt || null, id: last.id }) : null };
    },
    getId(record) {
      const id = String(record.id || '');
      if (!id) throw new Error('BOOKING_MIGRATION_RECORD_ID_REQUIRED');
      return id;
    }
  };
}

function normalizeBooking(record: BookingRecord): unknown {
  const normalized = { ...record };
  delete normalized.createdAt;
  delete normalized.updatedAt;
  delete normalized.confirmedAt;
  delete normalized.cancelledAt;
  return normalized;
}

export function createBookingsMigrationPlan(source: MigrationSource<BookingRecord>, target: PostgresBookingsRepository, pageSize = 100) {
  const targetAdapter: MigrationTarget<BookingRecord> = {
    async upsert(records) {
      for (const record of records) await target.create(String(record.id), record);
    },
    get: (id) => target.get(id),
    listIds: () => target.listIds()
  };
  return {
    domain: 'bookings',
    pageSize,
    source,
    target: targetAdapter,
    normalize: normalizeBooking,
    writeMode: 'shadow_write' as const
  };
}

export async function backfillBookings(runner: MigrationRunner<BookingRecord>, plan: ReturnType<typeof createBookingsMigrationPlan>): Promise<void> {
  let checkpoint = await runner.getCheckpoint(plan.domain);
  while (checkpoint.phase === 'planned' || checkpoint.phase === 'backfilling') {
    checkpoint = await runner.backfill(plan);
  }
}

export async function reconcileBookings(runner: MigrationRunner<BookingRecord>, plan: ReturnType<typeof createBookingsMigrationPlan>): Promise<ReconciliationReport> {
  return runner.reconcile(plan);
}
