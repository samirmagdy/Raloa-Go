import assert from 'node:assert/strict';
import { assertCan, assertEntitled, assertSite, can, resolveAuthorizationContext } from './server/core/authorization-policy';
import { createAuthorizationService } from './server/core/authorization-service';

const source = {
  async loadAccount(userId: string) { return userId === 'owner-1' ? { id: userId, plan: 'pro' as const, workspaceId: 'workspace-1' } : { id: userId, plan: 'free' as const, workspaceId: 'workspace-2' }; },
  async loadSite(siteId: string) { return siteId === 'site-1' ? { id: siteId, ownerUserId: 'owner-1', workspaceId: 'workspace-1' } : { id: siteId, ownerUserId: 'other-owner', workspaceId: 'workspace-2' }; },
  async loadMembership(userId: string, workspaceId: string, siteId: string) {
    if (userId === 'editor-1' && workspaceId === 'workspace-1' && siteId === 'site-1') return 'editor' as const;
    if (userId === 'viewer-1' && workspaceId === 'workspace-1' && siteId === 'site-1') return 'viewer' as const;
    return null;
  }
};

const owner = await resolveAuthorizationContext({ uid: 'owner-1' }, 'site-1', source);
assert.equal(owner.role, 'owner');
assert.equal(can(owner, 'domains:manage'), true);
assertCan(owner, 'site:publish');
assertEntitled(owner, 'customDomains');

const editor = await resolveAuthorizationContext({ uid: 'editor-1' }, 'site-1', source);
assert.equal(editor.role, 'editor');
assert.equal(can(editor, 'site:write'), true);
assert.equal(can(editor, 'billing:manage'), false);
assert.throws(() => assertCan(editor, 'billing:manage'), /FORBIDDEN/);
assert.throws(() => assertEntitled({ ...editor, entitlements: { ...editor.entitlements, analytics: false } }, 'analytics'), /ENTITLEMENT_REQUIRED/);
assert.throws(() => assertSite(editor, 'site-2'), /TENANT_BOUNDARY_VIOLATION/);
await assert.rejects(() => resolveAuthorizationContext({ uid: 'viewer-1' }, 'site-2', source), /RESOURCE_NOT_FOUND/);

const authorizationService = createAuthorizationService(source);
await authorizationService.requireSite({ uid: 'owner-1' }, 'site-1', 'site:write');
await assert.rejects(
  () => authorizationService.requireSite({ uid: 'owner-1' }, 'site-2', 'site:read'),
  /RESOURCE_NOT_FOUND/
);
await assert.rejects(
  () => authorizationService.requireSite({ uid: 'editor-1' }, 'site-2', 'site:read'),
  /RESOURCE_NOT_FOUND/
);
await assert.rejects(
  () => authorizationService.requireSite({ uid: 'editor-1' }, 'site-1', 'billing:manage'),
  /FORBIDDEN/
);
console.log('Authorization policy tests passed');
