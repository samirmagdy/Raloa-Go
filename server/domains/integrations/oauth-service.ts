import { oauthTokenBundleSchemaV1 } from '../../../src/shared/schema';
import { integrationEnvelopeCipher } from '../../infrastructure/crypto/envelope';
import { assertOAuthConnectionUsable, assertOAuthStateTransition } from '../../core/domain-invariants';

export type OAuthConnectionState = 'connected' | 'refreshing' | 'reauthorization_required' | 'revoked' | 'error';
export interface OAuthTokenBundle { accessToken: string; refreshToken?: string; expiresAt?: number; }
export interface OAuthConnection { id: string; userId: string; siteId?: string; provider: string; scopes: string[]; state: OAuthConnectionState; encryptedAccessToken: string; encryptedRefreshToken?: string; expiresAt?: number; refreshLockUntil?: number; tokenVersion: number; updatedAt: string; }
export interface OAuthProviderAdapter {
  readonly provider: string;
  readonly allowedScopes: readonly string[];
  refresh?(tokens: OAuthTokenBundle): Promise<OAuthTokenBundle>;
  revoke?(tokens: OAuthTokenBundle): Promise<void>;
  validate?(accessToken: string): Promise<void>;
}
export interface OAuthConnectionRepository {
  get(userId: string, provider: string, siteId?: string): Promise<OAuthConnection | null>;
  save(connection: OAuthConnection): Promise<void>;
  claimRefreshLock(id: string, lockUntil: number): Promise<boolean>;
  releaseRefreshLock(id: string): Promise<void>;
  revoke(id: string, updatedAt: string): Promise<void>;
}

async function tokenBundle(connection: OAuthConnection): Promise<OAuthTokenBundle> {
  return { accessToken: await integrationEnvelopeCipher.decrypt(connection.encryptedAccessToken), ...(connection.encryptedRefreshToken ? { refreshToken: await integrationEnvelopeCipher.decrypt(connection.encryptedRefreshToken) } : {}), expiresAt: connection.expiresAt };
}

function assertAllowedScopes(scopes: readonly string[], allowedScopes: readonly string[]): void {
  if (scopes.some((scope) => !allowedScopes.includes(scope))) throw new Error('OAUTH_SCOPE_NOT_ALLOWED');
}

export function createOAuthTokenService(repository: OAuthConnectionRepository, adapters: readonly OAuthProviderAdapter[]) {
  const adapterFor = (provider: string) => adapters.find((adapter) => adapter.provider === provider) || null;
  const service = {
    async connect(input: { id: string; userId: string; siteId?: string; provider: string; scopes: string[]; tokens: OAuthTokenBundle }): Promise<void> {
      const tokens = oauthTokenBundleSchemaV1.parse(input.tokens);
      const adapter = adapterFor(input.provider);
      if (!adapter) throw new Error('OAUTH_PROVIDER_NOT_SUPPORTED');
      assertAllowedScopes(input.scopes, adapter.allowedScopes);
      const now = new Date().toISOString();
      await repository.save({ id: input.id, userId: input.userId, siteId: input.siteId, provider: input.provider, scopes: [...input.scopes], state: 'connected', encryptedAccessToken: await integrationEnvelopeCipher.encrypt(tokens.accessToken), ...(tokens.refreshToken ? { encryptedRefreshToken: await integrationEnvelopeCipher.encrypt(tokens.refreshToken) } : {}), expiresAt: tokens.expiresAt, tokenVersion: 1, updatedAt: now });
    },
    async withAccessToken<T>(userId: string, provider: string, siteId: string | undefined, operation: (accessToken: string) => Promise<T>): Promise<T> {
      const connection = await repository.get(userId, provider, siteId);
      if (!connection || connection.state === 'revoked') throw new Error('OAUTH_REAUTH_REQUIRED');
      const adapter = adapterFor(provider);
      if (!adapter) throw new Error('OAUTH_PROVIDER_NOT_SUPPORTED');
      let current = connection;
      assertOAuthConnectionUsable(current.state);
      if (current.expiresAt && current.expiresAt <= Date.now() + 60_000) {
        if (!adapter.refresh || !current.encryptedRefreshToken) throw new Error('OAUTH_REAUTH_REQUIRED');
        const claimed = await repository.claimRefreshLock(current.id, Date.now() + 30_000);
        if (claimed) {
          try {
            const refreshed = await adapter.refresh(await tokenBundle(current));
            assertOAuthStateTransition(current.state, 'connected');
            await repository.save({ ...current, state: 'connected', encryptedAccessToken: await integrationEnvelopeCipher.encrypt(refreshed.accessToken), ...(refreshed.refreshToken ? { encryptedRefreshToken: await integrationEnvelopeCipher.encrypt(refreshed.refreshToken) } : {}), expiresAt: refreshed.expiresAt, tokenVersion: current.tokenVersion + 1, refreshLockUntil: undefined, updatedAt: new Date().toISOString() });
            current = { ...current, encryptedAccessToken: await integrationEnvelopeCipher.encrypt(refreshed.accessToken), expiresAt: refreshed.expiresAt };
          } catch (error) {
            assertOAuthStateTransition(current.state, 'reauthorization_required');
            await repository.save({ ...current, state: 'reauthorization_required', refreshLockUntil: undefined, updatedAt: new Date().toISOString() });
            throw error;
          } finally { await repository.releaseRefreshLock(current.id); }
        } else {
          throw new Error('OAUTH_REFRESH_IN_PROGRESS');
        }
      }
      return operation(await integrationEnvelopeCipher.decrypt(current.encryptedAccessToken));
    },
    async revoke(userId: string, provider: string, siteId?: string): Promise<void> {
      const connection = await repository.get(userId, provider, siteId);
      if (!connection) return;
      const adapter = adapterFor(provider);
      if (adapter?.revoke) await adapter.revoke(await tokenBundle(connection)).catch(() => undefined);
      await repository.revoke(connection.id, new Date().toISOString());
    },
    async validate(userId: string, provider: string, siteId?: string): Promise<void> {
      const adapter = adapterFor(provider);
      if (!adapter?.validate) return;
      await service.withAccessToken(userId, provider, siteId, (token) => adapter.validate!(token));
    }
  };
  return service;
}
