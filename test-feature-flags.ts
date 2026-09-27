import assert from 'node:assert/strict';
import { createFeatureFlagService, MemoryFeatureFlagRepository } from './server/infrastructure/feature-flags';

const repository = new MemoryFeatureFlagRepository();
const flags = createFeatureFlagService(repository, () => '2026-09-27T00:00:00.000Z');

assert.equal(await flags.isEnabled('postgres.reads.v2', { tenantId: 'tenant-a' }), false);
await flags.set('postgres.reads.v2', { enabled: true, tenantIds: ['tenant-a'] }, 'operator');
assert.equal(await flags.isEnabled('postgres.reads.v2', { tenantId: 'tenant-a' }), true);
assert.equal(await flags.isEnabled('postgres.reads.v2', { tenantId: 'tenant-b' }), false);

const rollout = await flags.set('public-rendering.v2', { enabled: true, rolloutPercentage: 100 }, 'operator');
assert.equal(rollout.version, 2);
assert.equal(await flags.isEnabled('public-rendering.v2', { tenantId: 'tenant-b' }), true);

await flags.kill('public-rendering.v2', 'on-call');
const evaluation = await flags.evaluate('public-rendering.v2', { tenantId: 'tenant-b' });
assert.equal(evaluation.enabled, false);
assert.equal(evaluation.reason, 'kill_switch');

const failingFlags = createFeatureFlagService({
  get: async () => { throw new Error('store unavailable'); },
  list: async () => { throw new Error('store unavailable'); },
  save: async () => { throw new Error('store unavailable'); }
});
const failSafe = await failingFlags.evaluate('postgres.writes.v2', { tenantId: 'tenant-a' });
assert.equal(failSafe.enabled, false);
assert.equal(failSafe.reason, 'error');

console.log('Feature flag tests passed');
