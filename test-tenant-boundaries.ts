import assert from 'node:assert/strict';
import { assertTenantScope, isTenantScoped, tenantKey } from './server/core/tenant-scope';

const tenantA = { ownerUserId: 'user-a', siteId: 'site-a' } as const;
const tenantB = { ownerUserId: 'user-b', siteId: 'site-b' } as const;
const record = { siteId: 'site-a', ownerUserId: 'user-a', id: 'resource-1' };

assert.doesNotThrow(() => assertTenantScope(tenantA, record));
const isBoundaryError = (error: unknown): boolean => error instanceof Error && error.message === 'TENANT_BOUNDARY_VIOLATION';
assert.throws(() => assertTenantScope(tenantB, record), isBoundaryError);
assert.equal(isTenantScoped(tenantA, record), true);
assert.equal(isTenantScoped(tenantB, record), false);
assert.equal(isTenantScoped(tenantA, { siteId: 'site-a', ownerUserId: 'user-b' }), false);
assert.equal(isTenantScoped(tenantA, null), false);
assert.equal(tenantKey(tenantA), 'user-a:site-a');
assert.throws(() => tenantKey({ ownerUserId: '', siteId: 'site-a' }), isBoundaryError);
console.log('Tenant boundary tests passed');
