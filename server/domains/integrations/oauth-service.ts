import crypto from 'node:crypto';

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

function encryptionKey(): Buffer {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY || (process.env.NODE_ENV !== 'production' ? process.env.AUTH_SESSION_SECRET : '');
  if (!secret || secret.length < 32) throw new Error('INTEGRATION_ENCRYPTION_KEY_NOT_CONFIGURED');
  return crypto.createHash('sha256').update(secret).digest();
}

function encrypt(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}

function decrypt(value: string): string {
  const [iv, tag, ciphertext] = value.split('.');
  if (!iv || !tag || !ciphertext) throw new Error('INVALID_ENCRYPTED_OAUTH_TOKEN');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}

function tokenBundle(connection: OAuthConnection): OAuthTokenBundle {
  return { accessToken: decrypt(connection.encryptedAccessToken), ...(connection.encryptedRefreshToken ? { refreshToken: decrypt(connection.encryptedRefreshToken) } : {}), expiresAt: connection.expiresAt };
}

function assertAllowedScopes(scopes: readonly string[], allowedScopes: readonly string[]): void {
  if (scopes.some((scope) => !allowedScopes.includes(scope))) throw new Error('OAUTH_SCOPE_NOT_ALLOWED');
}

export function createOAuthTokenService(repository: OAuthConnectionRepository, adapters: readonly OAuthProviderAdapter[]) {
  const adapterFor = (provider: string) => adapters.find((adapter) => adapter.provider === provider) || null;
  const service = {
    async connect(input: { id: string; userId: string; siteId?: string; provider: string; scopes: string[]; tokens: OAuthTokenBundle }): Promise<void> {
      const adapter = adapterFor(input.provider);
      if (!adapter) throw new Error('OAUTH_PROVIDER_NOT_SUPPORTED');
      assertAllowedScopes(input.scopes, adapter.allowedScopes);
      const now = new Date().toISOString();
      await repository.save({ id: input.id, userId: input.userId, siteId: input.siteId, provider: input.provider, scopes: [...input.scopes], state: 'connected', encryptedAccessToken: encrypt(input.tokens.accessToken), ...(input.tokens.refreshToken ? { encryptedRefreshToken: encrypt(input.tokens.refreshToken) } : {}), expiresAt: input.tokens.expiresAt, tokenVersion: 1, updatedAt: now });
    },
    async withAccessToken<T>(userId: string, provider: string, siteId: string | undefined, operation: (accessToken: string) => Promise<T>): Promise<T> {
      const connection = await repository.get(userId, provider, siteId);
      if (!connection || connection.state === 'revoked') throw new Error('OAUTH_REAUTH_REQUIRED');
      const adapter = adapterFor(provider);
      if (!adapter) throw new Error('OAUTH_PROVIDER_NOT_SUPPORTED');
      let current = connection;
      if (current.expiresAt && current.expiresAt <= Date.now() + 60_000) {
        if (!adapter.refresh || !current.encryptedRefreshToken) throw new Error('OAUTH_REAUTH_REQUIRED');
        const claimed = await repository.claimRefreshLock(current.id, Date.now() + 30_000);
        if (claimed) {
          try {
            const refreshed = await adapter.refresh(tokenBundle(current));
            await repository.save({ ...current, state: 'connected', encryptedAccessToken: encrypt(refreshed.accessToken), ...(refreshed.refreshToken ? { encryptedRefreshToken: encrypt(refreshed.refreshToken) } : {}), expiresAt: refreshed.expiresAt, tokenVersion: current.tokenVersion + 1, refreshLockUntil: undefined, updatedAt: new Date().toISOString() });
            current = { ...current, encryptedAccessToken: encrypt(refreshed.accessToken), expiresAt: refreshed.expiresAt };
          } catch (error) {
            await repository.save({ ...current, state: 'reauthorization_required', refreshLockUntil: undefined, updatedAt: new Date().toISOString() });
            throw error;
          } finally { await repository.releaseRefreshLock(current.id); }
        } else {
          throw new Error('OAUTH_REFRESH_IN_PROGRESS');
        }
      }
      return operation(decrypt(current.encryptedAccessToken));
    },
    async revoke(userId: string, provider: string, siteId?: string): Promise<void> {
      const connection = await repository.get(userId, provider, siteId);
      if (!connection) return;
      const adapter = adapterFor(provider);
      if (adapter?.revoke) await adapter.revoke(tokenBundle(connection)).catch(() => undefined);
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
