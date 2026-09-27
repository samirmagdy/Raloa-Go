import assert from 'node:assert/strict';
import { createOAuthTokenService, type OAuthConnection, type OAuthConnectionRepository } from './server/domains/integrations/oauth-service';

process.env.NODE_ENV = 'test';
process.env.AUTH_SESSION_SECRET = 'oauth-test-secret-with-at-least-32-bytes';

const connections = new Map<string, OAuthConnection>();
const repository: OAuthConnectionRepository = {
  get: async (userId, provider, siteId) => [...connections.values()].find((value) => value.userId === userId && value.provider === provider && value.siteId === siteId) || null,
  save: async (connection) => { connections.set(connection.id, connection); },
  claimRefreshLock: async (id, lockUntil) => { const value = connections.get(id); if (!value || (value.refreshLockUntil || 0) > Date.now()) return false; value.refreshLockUntil = lockUntil; return true; },
  releaseRefreshLock: async (id) => { const value = connections.get(id); if (value) value.refreshLockUntil = undefined; },
  revoke: async (id, updatedAt) => { const value = connections.get(id); if (value) { value.state = 'revoked'; value.updatedAt = updatedAt; } }
};

let refreshes = 0;
let revoked = 0;
const service = createOAuthTokenService(repository, [{
  provider: 'test',
  allowedScopes: ['read:profile'],
  async refresh() { refreshes += 1; return { accessToken: 'rotated-access', refreshToken: 'rotated-refresh', expiresAt: Date.now() + 3600000 }; },
  async revoke() { revoked += 1; }
}]);

await service.connect({ id: 'connection-1', userId: 'user-1', siteId: 'site-1', provider: 'test', scopes: ['read:profile'], tokens: { accessToken: 'initial-access', refreshToken: 'initial-refresh', expiresAt: Date.now() - 1 } });
const stored = connections.get('connection-1')!;
assert.notEqual(stored.encryptedAccessToken, 'initial-access');
assert.equal(await service.withAccessToken('user-1', 'test', 'site-1', async (token) => token), 'rotated-access');
assert.equal(refreshes, 1);
await assert.rejects(() => service.connect({ id: 'connection-2', userId: 'user-1', provider: 'test', scopes: ['write:profile'], tokens: { accessToken: 'x' } }), /OAUTH_SCOPE_NOT_ALLOWED/);
await service.revoke('user-1', 'test', 'site-1');
assert.equal(revoked, 1);
await assert.rejects(() => service.withAccessToken('user-1', 'test', 'site-1', async () => 'unreachable'), /OAUTH_REAUTH_REQUIRED/);
console.log('OAuth token service tests passed');
