import assert from 'node:assert/strict';
import { AuthBoundaryError, createServerAuth, type AuthDataSource, type AuthorizationResource, type OwnedResource } from '@raloa/auth';

const resources: AuthorizationResource[] = [
  'account', 'site', 'audience', 'booking', 'product', 'order', 'domain', 'media',
  'integration', 'billing', 'analytics', 'publishing', 'destructive'
];

const records = new Map<string, OwnedResource>(resources.map((resource) => [resource, {
  resource,
  id: `${resource}-tenant-a`,
  accountId: 'account-a',
  siteId: resource === 'account' || resource === 'billing' ? undefined : 'site-a',
  ownerUserId: resource === 'site' || resource === 'publishing' || resource === 'destructive' ? 'user-a' : undefined
}]));

const source: AuthDataSource = {
  async findUserByFirebaseUid(firebaseUid) {
    return { id: firebaseUid, firebaseUid };
  },
  async findAccountForUser(userId, accountId) {
    if (accountId && accountId !== `account-${userId.slice(-1)}`) return null;
    return { id: `account-${userId.slice(-1)}`, primaryUserId: userId, plan: 'pro', role: 'owner' };
  },
  async findSite(siteId) {
    if (siteId === 'site-a') return { id: siteId, accountId: 'account-a', ownerUserId: 'user-a' };
    if (siteId === 'site-b') return { id: siteId, accountId: 'account-b', ownerUserId: 'user-b' };
    return null;
  },
  async findMembership(userId, accountId) {
    if (userId === 'user-a' && accountId === 'account-a') return 'editor';
    if (userId === 'user-b' && accountId === 'account-b') return 'owner';
    return null;
  },
  async resolveEntitlements() { return { analytics: true, customDomains: true, studioControls: true }; },
  async findResource(resource, resourceId) {
    if (resourceId.endsWith('-tenant-b')) {
      return { resource, id: resourceId, accountId: 'account-b', siteId: resource === 'account' || resource === 'billing' ? undefined : 'site-b', ownerUserId: 'user-b' };
    }
    return records.get(resource) || null;
  }
};

const auth = createServerAuth({
  verifier: {
    async verifyIdToken() { return { firebaseUid: 'user-a' }; }
  },
  dataSource: source
});

for (const resource of resources) {
  const action = resource === 'destructive' ? 'destructive:delete' : resource === 'publishing' ? 'publishing:publish' : resource === 'billing' ? 'billing:read' : `${resource}:read`;
  const id = `${resource}-tenant-a`;
  await auth.requireResource({ authorization: 'Bearer test' }, resource, id, action);
  await assert.rejects(
    () => auth.requireResource({ authorization: 'Bearer test' }, resource, `${resource}-tenant-b`, action),
    (error: unknown) => error instanceof AuthBoundaryError && error.code === 'RESOURCE_NOT_FOUND' && error.statusCode === 404
  );
}

await assert.rejects(
  () => auth.requireResource({ authorization: 'Bearer test' }, 'audience', 'audience-tenant-a', 'billing:manage'),
  (error: unknown) => error instanceof AuthBoundaryError && error.code === 'FORBIDDEN'
);
await assert.rejects(
  () => auth.requireResource({ authorization: 'Bearer test' }, 'audience', 'audience-tenant-a', 'destructive:admin'),
  (error: unknown) => error instanceof AuthBoundaryError && error.code === 'FORBIDDEN'
);
await assert.rejects(
  () => auth.requireResource({ authorization: 'Bearer test' }, 'audience', 'audience-tenant-a', 'unknown:allow'),
  (error: unknown) => error instanceof AuthBoundaryError && error.code === 'FORBIDDEN'
);

console.log('Authorization resource policy tests passed');
