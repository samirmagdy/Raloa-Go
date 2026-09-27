import assert from 'node:assert/strict';
import { createFeatureFlagService, MemoryFeatureFlagRepository } from './server/infrastructure/feature-flags';
import { createStranglerRouter } from './server/infrastructure/migrations';

type RecordValue = { id: string; value: string };
const sourceWrites: RecordValue[] = [];
const targetWrites: RecordValue[] = [];
const mismatches: string[] = [];
const flags = createFeatureFlagService(new MemoryFeatureFlagRepository());
const router = createStranglerRouter<string, RecordValue>({
  source: {
    read: async (id) => ({ id, value: 'legacy' }),
    write: async (record) => { sourceWrites.push({ id: record, value: 'legacy' }); }
  },
  target: {
    read: async (id) => ({ id, value: 'new' }),
    write: async (record) => { targetWrites.push({ id: record, value: 'new' }); }
  },
  normalize: (record) => record,
  featureFlags: flags,
  readFlag: 'postgres.reads.v2',
  writeFlag: 'postgres.writes.v2',
  onMismatch: async ({ context }) => { mismatches.push(context.tenantId || 'unknown'); }
});

assert.deepEqual(await router.read('one', { tenantId: 'tenant-a' }), { id: 'one', value: 'legacy' });
assert.deepEqual(await router.shadowRead('one', { tenantId: 'tenant-a' }), { id: 'one', value: 'legacy' });
assert.deepEqual(mismatches, ['tenant-a']);

await flags.set('postgres.reads.v2', { enabled: true, tenantIds: ['tenant-a'] }, 'operator');
assert.deepEqual(await router.read('one', { tenantId: 'tenant-a' }), { id: 'one', value: 'new' });
assert.deepEqual(await router.read('one', { tenantId: 'tenant-b' }), { id: 'one', value: 'legacy' });

await flags.set('postgres.writes.v2', { enabled: true, tenantIds: ['tenant-a'] }, 'operator');
await router.write('one', { tenantId: 'tenant-a' }, 'dual');
assert.equal(sourceWrites.length, 1);
assert.equal(targetWrites.length, 1);

console.log('Strangler migration tests passed');
