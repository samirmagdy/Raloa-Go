import assert from 'node:assert/strict';
import { inspectMigrationEnvironment } from './server-config.mjs';

let result = inspectMigrationEnvironment({});
assert.equal(result.missing.length, 5);

result = inspectMigrationEnvironment({
  FIRESTORE_SOURCE_PROJECT_ID: 'source', FIRESTORE_SOURCE_DATABASE_ID: '(default)', FIREBASE_STORAGE_SOURCE_BUCKET: 'source.appspot.com',
  FIRESTORE_ARCHIVE_URI: 'file:///unsafe', MIGRATION_BATCH_SIZE: '0', MIGRATION_DRY_RUN: 'sometimes'
});
assert.ok(result.invalid.some((message) => message.includes('FIRESTORE_ARCHIVE_URI')));
assert.ok(result.invalid.some((message) => message.includes('MIGRATION_BATCH_SIZE')));
assert.ok(result.invalid.some((message) => message.includes('MIGRATION_DRY_RUN')));

result = inspectMigrationEnvironment({
  FIRESTORE_SOURCE_PROJECT_ID: 'source', FIRESTORE_SOURCE_DATABASE_ID: '(default)', FIREBASE_STORAGE_SOURCE_BUCKET: 'source.appspot.com',
  FIRESTORE_ARCHIVE_URI: 'gs://immutable/archive', MIGRATION_BATCH_SIZE: '100', MIGRATION_DRY_RUN: 'true'
});
assert.deepEqual(result.missing, []);
assert.deepEqual(result.invalid, []);

console.log('migration configuration tests passed');
