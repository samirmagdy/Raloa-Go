import type { EntityId, TenantId, SiteId } from '@raloa/domain';

export type Identity = { userId: EntityId; email?: string; provider: 'firebase' | 'test' };
export type Role = 'owner' | 'admin' | 'editor' | 'viewer';
export type TenantContext = { tenantId: TenantId; siteId?: SiteId; role: Role; identity: Identity };

export interface Authenticator {
  authenticate(token: string): Promise<Identity | null>;
}

export interface AuthorizationPolicy {
  resolve(identity: Identity, tenantId: TenantId, siteId?: SiteId): Promise<TenantContext>;
  assert(context: TenantContext, action: string): void;
}

export interface EntitlementService {
  has(context: TenantContext, capability: string): Promise<boolean>;
}

