import assert from 'node:assert/strict';
import { STORAGE_POLICIES } from './server/infrastructure/persistence/storage-policy';

for (const name of [
  'sites', 'bookings', 'products', 'inventory', 'orders', 'subscriptions',
  'integrations', 'domains', 'analytics', 'media', 'backgroundJobs'
] as const) {
  assert.equal(STORAGE_POLICIES[name].authority, 'postgresql', `${name} must default to PostgreSQL`);
  assert.equal(STORAGE_POLICIES[name].transactionalWrites, true, `${name} must support transactional writes`);
}

assert.equal(STORAGE_POLICIES.siteEditorConfiguration.authority, 'firestore_exception');
assert.equal(STORAGE_POLICIES.realtimeCollaboration.authority, 'firestore_exception');
assert.equal(STORAGE_POLICIES.siteEditorConfiguration.realtimeRequired, true);
console.log('Storage policy tests passed');
