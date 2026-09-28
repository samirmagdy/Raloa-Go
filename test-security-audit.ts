import assert from 'node:assert/strict';
import { isCookieAuthenticatedRequest, isSameOriginMutation } from './server/core/csrf';
import { createFirebaseAuthAdapter } from './server/adapters/firebase-auth';
import { safeJsonLd } from './apps/web/src/components/public/CreatorPage';

assert.equal(isCookieAuthenticatedRequest({ method: 'POST', cookie: 'raloa_session=session' }), true);
assert.equal(isCookieAuthenticatedRequest({ method: 'POST', cookie: 'raloa_session=session', authorization: 'Bearer firebase-token' }), false);
assert.equal(isSameOriginMutation({ method: 'POST', cookie: 'raloa_session=session', origin: 'https://raloa.app', appOrigin: 'https://raloa.app' }), true);
assert.equal(isSameOriginMutation({ method: 'POST', cookie: 'raloa_session=session', origin: 'https://evil.example', appOrigin: 'https://raloa.app' }), false);
assert.equal(isSameOriginMutation({ method: 'POST', cookie: 'raloa_session=session', appOrigin: 'https://raloa.app' }), false);
assert.equal(isSameOriginMutation({ method: 'GET', cookie: 'raloa_session=session', appOrigin: 'https://raloa.app' }), true);

let revokedCheck: boolean | undefined;
const adapter = createFirebaseAuthAdapter({
  async verifyIdToken(_token: string, checkRevoked?: boolean) {
    revokedCheck = checkRevoked;
    return { uid: 'user-1', email: 'user@example.test', aud: '', auth_time: 0, exp: 1, firebase: {}, iat: 0, iss: '', sub: '' } as any;
  }
});
assert.equal(await adapter.verifyBearerToken('short'), null);
assert.equal((await adapter.verifyBearerToken('a'.repeat(32)))?.uid, 'user-1');
assert.equal(revokedCheck, true);
const escapedJsonLd = safeJsonLd({ name: '</script><script>alert(1)</script>', separator: '\u2028' });
assert.equal(escapedJsonLd.includes('</script>'), false);
assert.equal(escapedJsonLd.includes('\\u003c/script\\u003e'), true);
console.log('Security audit regression tests passed');
