import assert from 'node:assert/strict';
import { buildRateLimitKey, RATE_LIMIT_POLICIES } from './server/core/rate-limit-policy';

assert.equal(RATE_LIMIT_POLICIES.authLogin.limit, 5);
assert.deepEqual(RATE_LIMIT_POLICIES.mediaUploads.dimensions, ['ip', 'user', 'site']);
assert.deepEqual(RATE_LIMIT_POLICIES.domainVerification.dimensions, ['ip', 'user', 'site', 'domain']);
assert.equal(RATE_LIMIT_POLICIES.publicBooking.limit, 10);
assert.equal(buildRateLimitKey('checkoutCreation', { ip: '1.2.3.4', site: 'site-1' }), 'checkoutCreation:ip=1.2.3.4|site=site-1');
assert.throws(() => buildRateLimitKey('oauthFlows', { ip: '1.2.3.4', user: 'user-1' }), /provider/);
console.log('Rate limit policy tests passed');
