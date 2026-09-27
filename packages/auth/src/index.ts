import type { EntityId, TenantId, SiteId } from '@raloa/domain';

export type Identity = { userId: EntityId; email?: string; provider: 'firebase' | 'test' };
export type Role = 'owner' | 'admin' | 'editor' | 'viewer';
export type TenantContext = { tenantId: TenantId; siteId?: SiteId; role: Role; identity: Identity };

/** Resources that may be addressed by an application authorization decision. */
export type AuthorizationResource =
  | 'account' | 'site' | 'audience' | 'booking' | 'product' | 'order'
  | 'domain' | 'media' | 'integration' | 'billing' | 'analytics'
  | 'publishing' | 'destructive';

/** Stable policy intents. Unknown actions are denied, never inferred. */
export type AuthorizationAction =
  | 'account:read' | 'account:manage'
  | 'site:read' | 'site:write' | 'site:publish'
  | 'audience:read' | 'audience:write' | 'audience:export'
  | 'booking:read' | 'booking:manage'
  | 'product:read' | 'product:write'
  | 'order:read' | 'order:manage' | 'order:refund'
  | 'domain:read' | 'domain:manage'
  | 'media:read' | 'media:write'
  | 'integration:read' | 'integration:manage'
  | 'billing:read' | 'billing:manage'
  | 'analytics:read'
  | 'publishing:publish' | 'publishing:rollback' | 'publishing:unpublish'
  | 'destructive:delete' | 'destructive:admin';

export type OwnedResource = {
  resource: AuthorizationResource;
  id: string;
  accountId?: string;
  siteId?: string;
  ownerUserId?: string;
};

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

export type FirebaseIdentity = {
  firebaseUid: string;
  email?: string;
  emailVerified?: boolean;
  expiresAt?: number;
};

export type AuthenticatedUser = {
  id: string;
  firebaseUid: string;
  email?: string;
  emailVerified?: boolean;
};

export type AccountContext = {
  id: string;
  primaryUserId: string;
  plan: string;
  role: Role;
};

export type SiteContext = {
  id: string;
  accountId: string;
  ownerUserId: string;
  handle?: string;
};

export type AuthorizationContext = {
  user: AuthenticatedUser;
  account: AccountContext;
  site?: SiteContext;
  entitlements: Record<string, boolean>;
};

export interface FirebaseServerVerifier {
  verifyIdToken(token: string): Promise<FirebaseIdentity | null>;
  verifySessionCookie?(cookie: string): Promise<FirebaseIdentity | null>;
  revokeRefreshTokens?(firebaseUid: string): Promise<void>;
}

export interface AuthDataSource {
  findUserByFirebaseUid(firebaseUid: string): Promise<AuthenticatedUser | null>;
  findAccountForUser(userId: string, accountId?: string): Promise<AccountContext | null>;
  findSite(siteId: string): Promise<SiteContext | null>;
  findMembership(userId: string, accountId: string): Promise<Role | null>;
  resolveEntitlements?(account: AccountContext): Promise<Record<string, boolean>>;
  /** Returns ownership metadata only; it must not make an authorization decision. */
  findResource?(resource: AuthorizationResource, resourceId: string): Promise<OwnedResource | null>;
}

export type AuthCredentials = {
  authorization?: string | null;
  sessionCookie?: string | null;
};

export class AuthBoundaryError extends Error {
  constructor(readonly code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'RESOURCE_NOT_FOUND' | 'ENTITLEMENT_REQUIRED', readonly statusCode: number, message: string) {
    super(message);
    this.name = 'AuthBoundaryError';
  }
}

const roleActions: Record<Role, readonly string[]> = {
  owner: [
    'account:read', 'account:manage', 'site:read', 'site:write', 'site:publish',
    'audience:read', 'audience:write', 'audience:export', 'booking:read', 'booking:manage',
    'product:read', 'product:write', 'order:read', 'order:manage', 'order:refund',
    'domain:read', 'domain:manage', 'media:read', 'media:write',
    'integration:read', 'integration:manage', 'billing:read', 'billing:manage',
    'analytics:read', 'publishing:publish', 'publishing:rollback', 'publishing:unpublish',
    'destructive:delete', 'destructive:admin', 'members:manage',
    // Legacy aliases retained while Express routes migrate to canonical intents.
    'site:publish', 'bookings:manage', 'orders:manage', 'domains:manage', 'billing:manage', 'integrations:manage', 'media:write'
  ],
  admin: [
    'account:read', 'site:read', 'site:write', 'site:publish',
    'audience:read', 'audience:write', 'audience:export', 'booking:read', 'booking:manage',
    'product:read', 'product:write', 'order:read', 'order:manage', 'order:refund',
    'domain:read', 'domain:manage', 'media:read', 'media:write',
    'integration:read', 'integration:manage', 'billing:read', 'billing:manage',
    'analytics:read', 'publishing:publish', 'publishing:rollback', 'publishing:unpublish',
    'destructive:delete', 'members:manage',
    'bookings:manage', 'orders:manage', 'domains:manage', 'billing:manage', 'integrations:manage', 'media:write'
  ],
  editor: [
    'account:read', 'site:read', 'site:write', 'site:publish',
    'audience:read', 'audience:write', 'booking:read', 'booking:manage',
    'product:read', 'product:write', 'order:read', 'order:manage',
    'domain:read', 'integration:read', 'billing:read', 'media:read', 'media:write', 'analytics:read', 'publishing:publish',
    'bookings:manage', 'orders:manage', 'media:write'
  ],
  viewer: [
    'account:read', 'site:read', 'audience:read', 'booking:read', 'product:read',
    'order:read', 'domain:read', 'media:read', 'integration:read', 'billing:read', 'analytics:read'
  ]
};

/** Shared permission predicate for legacy adapters and new server boundaries. */
export function isRoleActionAllowed(role: string, action: string): boolean {
  return (roleActions[role as Role] || []).includes(action);
}

export function createServerAuth(input: { verifier: FirebaseServerVerifier; dataSource: AuthDataSource; sessionCookieName?: string }) {
  const sessionCookieName = input.sessionCookieName || 'raloa_session';

  async function authenticate(credentials: AuthCredentials): Promise<FirebaseIdentity | null> {
    const bearer = credentials.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (bearer) return input.verifier.verifyIdToken(bearer);
    const cookie = credentials.sessionCookie || null;
    if (cookie && input.verifier.verifySessionCookie) return input.verifier.verifySessionCookie(cookie);
    return null;
  }

  async function currentUser(credentials: AuthCredentials): Promise<AuthenticatedUser | null> {
    const identity = await authenticate(credentials);
    return identity ? input.dataSource.findUserByFirebaseUid(identity.firebaseUid) : null;
  }

  async function requireUser(credentials: AuthCredentials): Promise<AuthenticatedUser> {
    const identity = await authenticate(credentials);
    if (!identity) throw new AuthBoundaryError('UNAUTHORIZED', 401, 'Authentication required.');
    const user = await input.dataSource.findUserByFirebaseUid(identity.firebaseUid);
    if (!user) throw new AuthBoundaryError('UNAUTHORIZED', 401, 'Application account is not provisioned.');
    return user;
  }

  async function requireAccount(credentials: AuthCredentials, accountId?: string): Promise<AuthorizationContext> {
    const user = await requireUser(credentials);
    const account = await input.dataSource.findAccountForUser(user.id, accountId);
    if (!account) throw new AuthBoundaryError('RESOURCE_NOT_FOUND', 404, 'Account not found.');
    const entitlements = input.dataSource.resolveEntitlements ? await input.dataSource.resolveEntitlements(account) : {};
    return { user, account, entitlements };
  }

  async function requireSiteAccess(credentials: AuthCredentials, siteId: string, action: string, entitlement?: string): Promise<AuthorizationContext> {
    const user = await requireUser(credentials);
    const site = await input.dataSource.findSite(siteId);
    if (!site) throw new AuthBoundaryError('RESOURCE_NOT_FOUND', 404, 'Site not found.');
    const account = await input.dataSource.findAccountForUser(user.id, site.accountId);
    if (!account) throw new AuthBoundaryError('RESOURCE_NOT_FOUND', 404, 'Site not found.');
    const role = site.ownerUserId === user.id ? 'owner' : await input.dataSource.findMembership(user.id, site.accountId);
    if (!role) throw new AuthBoundaryError('RESOURCE_NOT_FOUND', 404, 'Site not found.');
    if (!isRoleActionAllowed(role, action)) throw new AuthBoundaryError('FORBIDDEN', 403, 'You do not have permission to perform this action.');
    const context: AuthorizationContext = { user, account: { ...account, role }, site, entitlements: input.dataSource.resolveEntitlements ? await input.dataSource.resolveEntitlements({ ...account, role }) : {} };
    if (entitlement && context.entitlements[entitlement] !== true) throw new AuthBoundaryError('ENTITLEMENT_REQUIRED', 403, 'This capability is not enabled for the current plan.');
    return context;
  }

  async function requireResource(
    credentials: AuthCredentials,
    resource: AuthorizationResource,
    resourceId: string,
    action: string,
    entitlement?: string
  ): Promise<AuthorizationContext> {
    const user = await requireUser(credentials);
    if (!input.dataSource.findResource) {
      throw new AuthBoundaryError('FORBIDDEN', 403, 'Resource authorization is not configured.');
    }
    const owned = await input.dataSource.findResource(resource, resourceId);
    if (!owned) throw new AuthBoundaryError('RESOURCE_NOT_FOUND', 404, 'Resource not found.');

    // Resolve the tenant from server-side ownership metadata. Browser-supplied IDs
    // are only lookup keys and never establish access.
    const accountId = owned.accountId || (owned.siteId ? (await input.dataSource.findSite(owned.siteId))?.accountId : undefined);
    if (!accountId) throw new AuthBoundaryError('RESOURCE_NOT_FOUND', 404, 'Resource not found.');
    const account = await input.dataSource.findAccountForUser(user.id, accountId);
    if (!account) throw new AuthBoundaryError('RESOURCE_NOT_FOUND', 404, 'Resource not found.');
    const site = owned.siteId ? (await input.dataSource.findSite(owned.siteId)) || undefined : undefined;
    const role = owned.ownerUserId === user.id
      ? 'owner'
      : await input.dataSource.findMembership(user.id, account.id);
    if (!role) throw new AuthBoundaryError('RESOURCE_NOT_FOUND', 404, 'Resource not found.');
    if (!isRoleActionAllowed(role, action)) throw new AuthBoundaryError('FORBIDDEN', 403, 'You do not have permission to perform this action.');
    const entitlements = input.dataSource.resolveEntitlements ? await input.dataSource.resolveEntitlements({ ...account, role }) : {};
    if (entitlement && entitlements[entitlement] !== true) throw new AuthBoundaryError('ENTITLEMENT_REQUIRED', 403, 'This capability is not enabled for the current plan.');
    return { user, account: { ...account, role }, site, entitlements };
  }

  return { sessionCookieName, authenticate, currentUser, requireUser, requireAccount, requireSiteAccess, requireResource };
}
