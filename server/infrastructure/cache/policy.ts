export type CachePolicyName = 'publishedSite' | 'publicMetadata' | 'domainResolution';

export const CACHE_POLICIES = {
  publishedSite: { namespace: 'public-site', version: 1, ttlSeconds: 60, staleWhileRevalidateSeconds: 300, invalidateOn: ['SitePublished', 'SiteUpdated', 'SiteUnpublished'] },
  publicMetadata: { namespace: 'public-metadata', version: 1, ttlSeconds: 300, staleWhileRevalidateSeconds: 600, invalidateOn: ['SitePublished', 'SiteUpdated', 'SiteUnpublished'] },
  domainResolution: { namespace: 'domain-resolution', version: 1, ttlSeconds: 30, staleWhileRevalidateSeconds: 60, invalidateOn: ['DomainVerified', 'DomainDeleted', 'SitePublished', 'SiteUnpublished'] }
} as const;

export function cacheKey(policy: CachePolicyName, identifier: string): string {
  const definition = CACHE_POLICIES[policy];
  return `${definition.namespace}:v${definition.version}:${identifier.trim().toLowerCase()}`;
}
