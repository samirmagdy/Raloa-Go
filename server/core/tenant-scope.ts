export type TenantScope = {
  ownerUserId: string;
  siteId: string;
};

export type TenantScopedRecord = {
  siteId?: string | null;
  ownerUserId?: string | null;
  userId?: string | null;
  creatorUserId?: string | null;
  hostUserId?: string | null;
};

export const tenantBoundaryError = (): Error => new Error('TENANT_BOUNDARY_VIOLATION');

/** Fail closed when a repository returns a record outside the requested tenant. */
export function assertTenantScope(scope: TenantScope, record: TenantScopedRecord | null | undefined): void {
  if (!record || record.siteId !== scope.siteId) throw tenantBoundaryError();
  const owner = record.ownerUserId ?? record.userId ?? record.creatorUserId ?? record.hostUserId;
  if (owner && owner !== scope.ownerUserId) throw tenantBoundaryError();
}

export function isTenantScoped(scope: TenantScope, record: TenantScopedRecord | null | undefined): boolean {
  try {
    assertTenantScope(scope, record);
    return true;
  } catch {
    return false;
  }
}

export function tenantKey(scope: TenantScope): string {
  if (!scope.ownerUserId || !scope.siteId) throw tenantBoundaryError();
  return `${scope.ownerUserId}:${scope.siteId}`;
}
