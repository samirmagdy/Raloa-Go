export function buildTenant(overrides: Partial<{ id: string; ownerUserId: string }> = {}) {
  return { id: 'tenant-test', ownerUserId: 'user-test', ...overrides };
}

export function buildSite(overrides: Partial<{ id: string; tenantId: string; userId: string; username: string; isPublished: boolean }> = {}) {
  return { id: 'site-test', tenantId: 'tenant-test', userId: 'user-test', username: 'test-creator', isPublished: false, ...overrides };
}

export function buildOrder(overrides: Partial<{ id: string; siteId: string; state: string }> = {}) {
  return { id: 'order-test', siteId: 'site-test', state: 'pending', ...overrides };
}

