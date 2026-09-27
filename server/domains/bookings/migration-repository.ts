import type { FeatureFlagContext, FeatureFlagService } from '../../infrastructure/feature-flags';
import type { BookingRecord, BookingsRepository } from '../../repositories/contracts';

export type BookingMigrationMode = 'source' | 'dual' | 'target';

export interface BookingMigrationObserver {
  mismatch?(operation: 'get' | 'list', context: FeatureFlagContext, bookingId?: string): void | Promise<void>;
  writeFailure?(operation: 'create' | 'update', context: FeatureFlagContext, error: unknown): void | Promise<void>;
}

function normalize(record: BookingRecord | null): unknown {
  if (!record) return null;
  const copy = { ...record };
  delete copy.updatedAt;
  delete copy.createdAt;
  return copy;
}

function equivalent(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function createBookingMigrationRepository(
  source: BookingsRepository,
  target: BookingsRepository,
  flags: FeatureFlagService,
  observer: BookingMigrationObserver = {}
): BookingsRepository & { read(id: string, context: FeatureFlagContext): Promise<BookingRecord | null>; listScoped(hostUserId: string, siteId: string | undefined, limit: number, context: FeatureFlagContext): Promise<BookingRecord[]>; shadowGet(id: string, context: FeatureFlagContext): Promise<BookingRecord | null>; shadowList(hostUserId: string, siteId: string | undefined, limit: number, context: FeatureFlagContext): Promise<BookingRecord[]> } {
  const contextFor = (context: FeatureFlagContext, record?: BookingRecord): FeatureFlagContext => ({ ...context, siteId: context.siteId || (typeof record?.siteId === 'string' ? record.siteId : undefined), userId: context.userId || (typeof record?.hostUserId === 'string' ? record.hostUserId : undefined) });

  const compareGet = async (id: string, context: FeatureFlagContext, sourceRecord: BookingRecord | null): Promise<void> => {
    const targetRecord = await target.get(id);
    if (!equivalent(normalize(sourceRecord), normalize(targetRecord))) await observer.mismatch?.('get', context, id);
  };

  const compareList = async (hostUserId: string, siteId: string | undefined, limit: number, context: FeatureFlagContext, sourceRecords: BookingRecord[]): Promise<void> => {
    const targetRecords = await target.listForHost(hostUserId, siteId, limit);
    const sourceNormalized = sourceRecords.map(normalize);
    const targetNormalized = targetRecords.map(normalize);
    if (!equivalent(sourceNormalized, targetNormalized)) await observer.mismatch?.('list', context);
  };

  const writeMode = async (context: FeatureFlagContext): Promise<BookingMigrationMode> => {
    if (await flags.isEnabled('bookings.postgres.authoritative.v2', context)) return 'target';
    return (await flags.isEnabled('bookings.postgres.writes.v2', context)) ? 'dual' : 'source';
  };

  return {
    async get(id) { return source.get(id); },
    async listForHost(hostUserId, siteId, limit = 100) { return source.listForHost(hostUserId, siteId, limit); },
    async create(id, booking) {
      const context = contextFor({ tenantId: typeof booking.siteId === 'string' ? booking.siteId : undefined }, booking);
      const mode = await writeMode(context);
      if (mode === 'source') return source.create(id, booking);
      if (mode === 'target') return target.create(id, booking);
      await source.create(id, booking);
      try { await target.create(id, booking); } catch (error) { await observer.writeFailure?.('create', context, error); throw error; }
    },
    async update(id, changes) {
      const current = await source.get(id);
      const context = contextFor({}, current || changes);
      const mode = await writeMode(context);
      if (mode === 'source') return source.update(id, changes);
      if (mode === 'target') return target.update(id, changes);
      await source.update(id, changes);
      try { await target.update(id, changes); } catch (error) { await observer.writeFailure?.('update', context, error); throw error; }
    },
    async read(id, context) {
      if (await flags.isEnabled('bookings.postgres.authoritative.v2', context) && await flags.isEnabled('bookings.postgres.reads.v2', context)) return target.get(id);
      const sourceRecord = await source.get(id);
      if (await flags.isEnabled('bookings.postgres.reads.v2', context)) await compareGet(id, context, sourceRecord);
      return sourceRecord;
    },
    async listScoped(hostUserId, siteId, limit, context) {
      if (await flags.isEnabled('bookings.postgres.authoritative.v2', context) && await flags.isEnabled('bookings.postgres.reads.v2', context)) return target.listForHost(hostUserId, siteId, limit);
      const sourceRecords = await source.listForHost(hostUserId, siteId, limit);
      if (await flags.isEnabled('bookings.postgres.reads.v2', context)) await compareList(hostUserId, siteId, limit, context, sourceRecords);
      return sourceRecords;
    },
    async shadowGet(id, context) {
      const sourceRecord = await source.get(id);
      await compareGet(id, context, sourceRecord);
      return sourceRecord;
    },
    async shadowList(hostUserId, siteId, limit, context) {
      const sourceRecords = await source.listForHost(hostUserId, siteId, limit);
      await compareList(hostUserId, siteId, limit, context, sourceRecords);
      return sourceRecords;
    }
  };
}
