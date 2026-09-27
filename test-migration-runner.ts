import assert from 'node:assert/strict';
import { MemoryMigrationCheckpointStore } from './server/infrastructure/migrations/memory-checkpoint-store';
import { MigrationRunner, routingForPhase } from './server/infrastructure/migrations/runner';
import type { MigrationPlan } from './server/infrastructure/migrations/types';

type RecordValue = { id: string; value: string };
const sourceRecords: RecordValue[] = [{ id: 'a', value: 'one' }, { id: 'b', value: 'two' }];
const targetRecords = new Map<string, RecordValue>();
const plan: MigrationPlan<RecordValue> = {
  domain: 'example',
  pageSize: 1,
  writeMode: 'dual_write',
  source: {
    async listPage(cursor, limit) {
      const start = cursor ? Number(cursor) : 0;
      const records = sourceRecords.slice(start, start + limit);
      return { records, nextCursor: start + records.length < sourceRecords.length ? String(start + records.length) : null };
    },
    getId: (record) => record.id
  },
  target: {
    async upsert(records) { for (const record of records) targetRecords.set(record.id, record); },
    async get(id) { return targetRecords.get(id) ?? null; },
    async listIds() { return [...targetRecords.keys()]; }
  },
  normalize: (record) => record
};

const runner = new MigrationRunner(new MemoryMigrationCheckpointStore());
await runner.backfill(plan);
await runner.backfill(plan);
const report = await runner.reconcile(plan);
assert.equal(report.equivalent, true);
await runner.enableDualWrite('example');
await runner.switchToTarget('example');
assert.deepEqual(routingForPhase('example', 'target_authoritative'), {
  domain: 'example', readMode: 'target', writeMode: 'target_only', rollbackEnabled: true
});
console.log('Migration runner tests passed');
