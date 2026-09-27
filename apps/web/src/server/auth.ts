import { cookies, headers } from 'next/headers';
import { getPlanCapabilities } from '../../../../src/lib/planCapabilities';
import { createServerAuth, type AuthCredentials, type AuthorizationContext, type AuthenticatedUser, type AuthDataSource } from '@raloa/auth';
import { getFirebaseServerVerifier } from './firebase-admin';
import { getWebAuthDataSource } from './database';

const authDataSource: AuthDataSource = {
  async findUserByFirebaseUid(firebaseUid) { return getWebAuthDataSource().findUserByFirebaseUid(firebaseUid); },
  async findAccountForUser(userId, accountId) { return getWebAuthDataSource().findAccountForUser(userId, accountId); },
  async findSite(siteId) { return getWebAuthDataSource().findSite(siteId); },
  async findMembership(userId, accountId) { return getWebAuthDataSource().findMembership(userId, accountId); },
  async resolveEntitlements(account) {
      const capabilities = getPlanCapabilities({ plan: account.plan as 'free' | 'pro' | 'studio' });
      return {
        analytics: capabilities.analytics,
        customDomains: capabilities.customDomains,
        studioControls: capabilities.studioControls,
        media: capabilities.maxMedia !== 0
      };
  }
};

const serverAuth = createServerAuth({ verifier: getFirebaseServerVerifier(), dataSource: authDataSource });

export type { AuthenticatedUser, AuthorizationContext };

async function requestCredentials(): Promise<AuthCredentials> {
  const requestHeaders = await headers();
  const requestCookies = await cookies();
  return {
    authorization: requestHeaders.get('authorization'),
    sessionCookie: requestCookies.get('raloa_session')?.value || null
  };
}

export function getServerAuth() { return serverAuth; }

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  return serverAuth.currentUser(await requestCredentials());
}

export async function requireCurrentUser(): Promise<AuthenticatedUser> {
  return serverAuth.requireUser(await requestCredentials());
}

export async function requireAccount(accountId?: string): Promise<AuthorizationContext> {
  return serverAuth.requireAccount(await requestCredentials(), accountId);
}

export async function requireSiteAccess(siteId: string, action: string, entitlement?: string): Promise<AuthorizationContext> {
  return serverAuth.requireSiteAccess(await requestCredentials(), siteId, action, entitlement);
}
