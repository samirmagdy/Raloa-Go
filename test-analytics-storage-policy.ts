import assert from 'node:assert/strict';
import { ANALYTICS_STORAGE_POLICY } from './server/infrastructure/analytics/storage-policy';

assert.equal(ANALYTICS_STORAGE_POLICY.studioDailyRollups.lane, 'operational_postgresql');
assert.equal(ANALYTICS_STORAGE_POLICY.studioVisitorDays.lane, 'operational_postgresql');
assert.equal(ANALYTICS_STORAGE_POLICY.rawEvents.lane, 'analytical_bigquery');
assert.equal(ANALYTICS_STORAGE_POLICY.rawEvents.queryWorkload, 'warehouse');
assert.equal(ANALYTICS_STORAGE_POLICY.postgresEventBuffer.authoritative, false);
assert.equal(ANALYTICS_STORAGE_POLICY.postgresEventBuffer.retentionDays, 7);
console.log('Analytics storage policy tests passed');
