import type { AuthenticatedUser } from '../../server-services';
import { isRoleActionAllowed } from '@raloa/auth';
import { capabilitiesForPlan } from '../domains/entitlements/service';
import type { PlanCapabilities, PlanTier } from '../../src/lib/planCapabilities';

export type ApplicationRole = 'owner' | 'admin' | 'editor' | 'viewer';
export type PolicyAction =
  | 'site:read' | 'site:write' | 'site:publish' | 'members:manage'
  | 'analytics:read' | 'bookings:manage' | 'orders:manage' | 'media:write'
  | 'domains:manage' | 'billing:manage' | 'integrations:manage';
export type Entitlement = 'analytics' | 'customDomains' | 'studioControls';

export type AccountAuthorizationRecord = {
  id: string;
  plan?: PlanTier;
  referralProUntil?: string | null;
  role?: ApplicationRole;
  workspaceId?: string;
};

export type SiteAuthorizationRecord = {
  id: string;
  ownerUserId: string;
  workspaceId?: string;
};

export type AuthorizationContext = {
  identity: AuthenticatedUser;
  account: AccountAuthorizationRecord;
  workspaceId: string;
  site: SiteAuthorizationRecord;
  role: ApplicationRole;
  entitlements: PlanCapabilities;
};

export interface AuthorizationDataSource {
  loadAccount(userId: string): Promise<AccountAuthorizationRecord | null>;
  loadSite(siteId: string): Promise<SiteAuthorizationRecord | null>;
  loadMembership(userId: string, workspaceId: string, siteId: string): Promise<ApplicationRole | null>;
}

export async function resolveAuthorizationContext(identity: AuthenticatedUser, siteId: string, source: AuthorizationDataSource): Promise<AuthorizationContext> {
  const [account, site] = await Promise.all([source.loadAccount(identity.uid), source.loadSite(siteId)]);
  if (!account || !site) throw new Error('RESOURCE_NOT_FOUND');
  const workspaceId = site.workspaceId || account.workspaceId || account.id;
  const role = site.ownerUserId === identity.uid
    ? 'owner'
    : await source.loadMembership(identity.uid, workspaceId, site.id);
  if (!role) throw new Error('RESOURCE_NOT_FOUND');
  return { identity, account, workspaceId, site, role, entitlements: capabilitiesForPlan((account.plan ?? 'free') as PlanTier) as unknown as PlanCapabilities };
}

export function can(context: AuthorizationContext, action: PolicyAction): boolean {
  return isRoleActionAllowed(context.role, action);
}

export function assertCan(context: AuthorizationContext, action: PolicyAction): void {
  if (!can(context, action)) throw new Error('FORBIDDEN');
}

export function assertEntitled(context: AuthorizationContext, entitlement: Entitlement): void {
  if (!context.entitlements[entitlement]) throw new Error('ENTITLEMENT_REQUIRED');
}

export function assertSite(context: AuthorizationContext, siteId: string): void {
  if (context.site.id !== siteId) throw new Error('TENANT_BOUNDARY_VIOLATION');
}
