import assert from 'node:assert/strict';
import { createFeatureFlagService, MemoryFeatureFlagRepository } from './server/infrastructure/feature-flags';
import { createBookingMigrationRepository } from './server/domains/bookings/migration-repository';
import type { BookingRecord, BookingsRepository } from './server/repositories/contracts';

function memoryRepository(): BookingsRepository {
  const records = new Map<string, BookingRecord>();
  return {
    get: async (id) => records.get(id) || null,
    listForHost: async (host, site, limit = 100) => [...records.values()].filter((record) => record.hostUserId === host && (!site || record.siteId === site)).slice(0, limit),
    create: async (id, booking) => { records.set(id, { ...booking, id }); },
    update: async (id, changes) => { records.set(id, { ...(records.get(id) || { id }), ...changes }); }
  };
}

const source = memoryRepository();
const target = memoryRepository();
await source.create('booking-1', { id: 'booking-1', hostUserId: 'host-1', siteId: 'site-1', status: 'pending_confirmation' });
const flags = createFeatureFlagService(new MemoryFeatureFlagRepository());
const mismatches: string[] = [];
const repository = createBookingMigrationRepository(source, target, flags, { mismatch: async (_, context) => { mismatches.push(context.tenantId || 'unknown'); } });

assert.deepEqual(await repository.get('booking-1'), await source.get('booking-1'));
await repository.shadowGet('booking-1', { tenantId: 'site-1' });
assert.deepEqual(mismatches, ['site-1']);

await flags.set('bookings.postgres.writes.v2', { enabled: true, tenantIds: ['site-1'] }, 'test');
await repository.create('booking-2', { id: 'booking-2', hostUserId: 'host-1', siteId: 'site-1', status: 'pending_confirmation' });
assert.ok(await source.get('booking-2'));
assert.ok(await target.get('booking-2'));

await flags.set('bookings.postgres.reads.v2', { enabled: true, tenantIds: ['site-1'] }, 'test');
await flags.set('bookings.postgres.authoritative.v2', { enabled: true, tenantIds: ['site-1'] }, 'test');
await target.update('booking-2', { status: 'confirmed' });
assert.equal((await repository.read('booking-2', { tenantId: 'site-1' }))?.status, 'confirmed');

await flags.kill('bookings.postgres.authoritative.v2', 'rollback');
assert.equal((await repository.read('booking-2', { tenantId: 'site-1' }))?.status, 'pending_confirmation');

console.log('Booking migration routing tests passed');
