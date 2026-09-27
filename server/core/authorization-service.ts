import type { AuthenticatedUser } from '../../server-services';
import {
  assertCan,
  assertEntitled,
  type AuthorizationContext,
  type AuthorizationDataSource,
  type Entitlement,
  type PolicyAction,
  resolveAuthorizationContext
} from './authorization-policy';

/**
 * Application authorization seam. Authentication only supplies the actor UID;
 * this service resolves account, tenant/site, role, and plan capabilities.
 */
export class AuthorizationService {
  constructor(private readonly source: AuthorizationDataSource) {}

  async requireSite(
    identity: AuthenticatedUser,
    siteId: string,
    action?: PolicyAction,
    entitlement?: Entitlement
  ): Promise<AuthorizationContext> {
    const context = await resolveAuthorizationContext(identity, siteId, this.source);
    if (action) assertCan(context, action);
    if (entitlement) assertEntitled(context, entitlement);
    return context;
  }
}

export function createAuthorizationService(source: AuthorizationDataSource): AuthorizationService {
  return new AuthorizationService(source);
}

