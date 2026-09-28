import assert from 'node:assert/strict';
import { buildMigrationPlan, isImmutableArchiveUri, migrationReportHash } from './server/migrations/migration-tools';

const source = [{ id: 'one', ownerId: 'tenant-a', payload: { status: 'ready', value: 1 } }];
assert.equal(buildMigrationPlan(source, source).canCutover, true);
assert.equal(buildMigrationPlan(source, [{ ...source[0], ownerId: 'tenant-b' }]).differences[0]?.kind, 'ownership_mismatch');
assert.equal(buildMigrationPlan(source, []).differences[0]?.kind, 'missing_target');
assert.equal(buildMigrationPlan([], [{ id: 'two', ownerId: 'tenant-a', payload: {} }]).differences[0]?.kind, 'unexpected_target');
assert.notEqual(migrationReportHash({ a: 1 }), migrationReportHash({ a: 2 }));
assert.equal(isImmutableArchiveUri('gs://raloa-archive/firestore/2026-09-28.json'), true);
assert.equal(isImmutableArchiveUri('not-an-archive'), false);
console.log('Migration tooling tests passed');
