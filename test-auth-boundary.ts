import assert from 'node:assert/strict';
import { createServerAuth, AuthBoundaryError, type AuthDataSource, type AuthenticatedUser, type FirebaseIdentity, type AccountContext, type SiteContext } from './packages/auth/src/index.ts';

const identities: Record<string, FirebaseIdentity> = {
  tokenA: { firebaseUid: 'firebase-a', email: 'a@example.test' },
  tokenB: { firebaseUid: 'firebase-b', email: 'b@example.test' }
};
const users: Record<string, AuthenticatedUser> = {
  'firebase-a': { id: 'user-a', firebaseUid: 'firebase-a', email: 'a@example.test' },
  'firebase-b': { id: 'user-b', firebaseUid: 'firebase-b', email: 'b@example.test' }
};
const accounts: Record<string, AccountContext> = {
  'account-a': { id: 'account-a', primaryUserId: 'user-a', plan: 'free', role: 'owner' },
  'account-b': { id: 'account-b', primaryUserId: 'user-b', plan: 'pro', role: 'owner' },
  'account-c': { id: 'account-c', primaryUserId: 'user-c', plan: 'pro', role: 'owner' }
};
const sites: Record<string, SiteContext> = {
  'site-a': { id: 'site-a', accountId: 'account-a', ownerUserId: 'user-a', handle: 'a' },
  'site-b': { id: 'site-b', accountId: 'account-b', ownerUserId: 'user-b', handle: 'b' },
  'site-c': { id: 'site-c', accountId: 'account-c', ownerUserId: 'user-c', handle: 'c' }
};

const source: AuthDataSource = {
  async findUserByFirebaseUid(firebaseUid) { return users[firebaseUid] || null; },
  async findAccountForUser(userId, accountId) {
    const account = Object.values(accounts).find((candidate) => (!accountId || candidate.id === accountId) && (candidate.primaryUserId === userId || (candidate.id === 'account-b' && userId === 'user-a')));
    return account || null;
  },
  async findSite(siteId) { return sites[siteId] || null; },
  async findMembership(userId, accountId) { return userId === 'user-a' && accountId === 'account-b' ? 'viewer' : null; },
  async resolveEntitlements(account) { return { analytics: account.plan !== 'free' }; }
};
const auth = createServerAuth({
  verifier: {
    async verifyIdToken(token) { return identities[token] || null; }
  },
  dataSource: source
});

const actor = await auth.requireUser({ authorization: 'Bearer tokenA' });
assert.equal(actor.id, 'user-a');
const account = await auth.requireAccount({ authorization: 'Bearer tokenA' });
assert.equal(account.account.id, 'account-a');

await assert.rejects(
  auth.requireSiteAccess({ authorization: 'Bearer tokenA' }, 'site-c', 'site:read'),
  (error: unknown) => error instanceof AuthBoundaryError && error.code === 'RESOURCE_NOT_FOUND' && error.statusCode === 404
);
await assert.rejects(
  auth.requireSiteAccess({ authorization: 'Bearer tokenA' }, 'site-b', 'billing:manage'),
  (error: unknown) => error instanceof AuthBoundaryError && error.code === 'FORBIDDEN' && error.statusCode === 403
);
await assert.rejects(
  auth.requireSiteAccess({ authorization: 'Bearer tokenA' }, 'site-a', 'site:read', 'analytics'),
  (error: unknown) => error instanceof AuthBoundaryError && error.code === 'ENTITLEMENT_REQUIRED' && error.statusCode === 403
);
await assert.rejects(
  auth.requireUser({ authorization: 'Bearer token-does-not-exist' }),
  (error: unknown) => error instanceof AuthBoundaryError && error.code === 'UNAUTHORIZED' && error.statusCode === 401
);

const browserSuppliedUserId = 'user-b';
const resolved = await auth.requireSiteAccess({ authorization: 'Bearer tokenA' }, 'site-a', 'site:read');
assert.equal(resolved.user.id, 'user-a');
assert.notEqual(resolved.user.id, browserSuppliedUserId);

console.log('Centralized Firebase identity and tenant authorization tests passed');
