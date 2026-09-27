import type { BookingRecord } from '../../repositories/contracts';
import type { MigrationRunner } from '../../infrastructure/migrations';
import type { MigrationPlan, ReconciliationReport } from '../../infrastructure/migrations/types';

export type CalendarJobVerification = {
  bookingId: string;
  expectedStatus: 'completed' | 'cancelled';
  exists: boolean;
  status: string | null;
  passed: boolean;
};

export type ConcurrentReservationVerification = {
  attempts: number;
  successes: number;
  failures: number;
  passed: boolean;
};

export type BookingMigrationVerification = {
  reconciliation: ReconciliationReport;
  cancelledBookings: Array<{ id: string; sourceStatus: string | null; targetStatus: string | null; passed: boolean }>;
  calendarJobs: CalendarJobVerification[];
  concurrency: ConcurrentReservationVerification | null;
  passed: boolean;
};

export class BookingCutoverBlockedError extends Error {
  constructor(public readonly verification: BookingMigrationVerification) {
    super('BOOKING_CUTOVER_BLOCKED_BY_VERIFICATION');
  }
}

function status(record: BookingRecord | null): string | null {
  return record && typeof record.status === 'string' ? record.status : null;
}

export async function verifyBookingMigration(options: {
  plan: MigrationPlan<BookingRecord>;
  cancelledBookingIds?: string[];
  calendarJob?: (bookingId: string) => Promise<{ exists: boolean; status?: string | null }>;
  concurrentReservation?: () => Promise<unknown>;
}): Promise<BookingMigrationVerification> {
  const reconciliation = await reconcileWithoutChangingPhase(options.plan);
  const cancelledBookings = [];
  for (const id of options.cancelledBookingIds || []) {
    const sourceRecord = await findSourceRecord(options.plan, id);
    const target = await options.plan.target.get(id);
    const sourceStatus = status(sourceRecord);
    const targetStatus = status(target);
    cancelledBookings.push({ id, sourceStatus, targetStatus, passed: sourceStatus === 'cancelled' && targetStatus === 'cancelled' });
  }

  const calendarJobs: CalendarJobVerification[] = [];
  if (options.calendarJob) {
    for (const cancelled of options.cancelledBookingIds || []) {
      const job = await options.calendarJob(cancelled);
      calendarJobs.push({ bookingId: cancelled, expectedStatus: 'cancelled', exists: job.exists, status: job.status || null, passed: job.exists && job.status === 'cancelled' });
    }
  }

  let concurrency: ConcurrentReservationVerification | null = null;
  if (options.concurrentReservation) {
    const results = await Promise.allSettled([options.concurrentReservation(), options.concurrentReservation()]);
    const successes = results.filter((result) => result.status === 'fulfilled').length;
    concurrency = { attempts: results.length, successes, failures: results.length - successes, passed: successes === 1 && results.length - successes === 1 };
  }

  const passed = reconciliation.equivalent
    && cancelledBookings.every((item) => item.passed)
    && calendarJobs.every((item) => item.passed)
    && (concurrency === null || concurrency.passed);
  return { reconciliation, cancelledBookings, calendarJobs, concurrency, passed };
}

async function findSourceRecord(plan: MigrationPlan<BookingRecord>, id: string): Promise<BookingRecord | null> {
  let cursor: string | null = null;
  do {
    const page = await plan.source.listPage(cursor, plan.pageSize);
    const match = page.records.find((record) => plan.source.getId(record) === id);
    if (match) return match;
    cursor = page.nextCursor;
  } while (cursor !== null);
  return null;
}

export function assertBookingCutoverSafe(verification: BookingMigrationVerification): void {
  if (!verification.passed) throw new BookingCutoverBlockedError(verification);
}

export async function switchBookingsToTarget<T>(runner: MigrationRunner<T>, verification: BookingMigrationVerification): Promise<void> {
  assertBookingCutoverSafe(verification);
  const checkpoint = await runner.getCheckpoint('bookings');
  if (checkpoint.phase === 'reconciling') await runner.transition('bookings', 'shadow_read');
  if (checkpoint.phase === 'shadow_read') await runner.enableDualWrite('bookings');
  await runner.switchToTarget('bookings');
}

async function reconcileWithoutChangingPhase(plan: MigrationPlan<BookingRecord>): Promise<ReconciliationReport> {
  const missingInTarget: string[] = [];
  const mismatched: string[] = [];
  const sourceIds = new Set<string>();
  let cursor: string | null = null;
  let scanned = 0;
  do {
    const page = await plan.source.listPage(cursor, plan.pageSize);
    for (const record of page.records) {
      const id = plan.source.getId(record);
      sourceIds.add(id);
      const target = await plan.target.get(id);
      if (!target) missingInTarget.push(id);
      else if (JSON.stringify(plan.normalize(record)) !== JSON.stringify(plan.normalize(target))) mismatched.push(id);
    }
    scanned += page.records.length;
    cursor = page.nextCursor;
  } while (cursor !== null);
  const extraInTarget = (await plan.target.listIds()).filter((id) => !sourceIds.has(id));
  return { domain: plan.domain, scanned, missingInTarget, mismatched, extraInTarget, equivalent: missingInTarget.length === 0 && mismatched.length === 0 && extraInTarget.length === 0, generatedAt: new Date().toISOString() };
}
