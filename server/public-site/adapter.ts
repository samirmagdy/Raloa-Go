import { normalizeSiteContent } from '../../src/shared/schemas';
import type { PublicCreatorAdapter, PublicCreatorMetadata, PublicCreatorPage } from '../../src/shared/public';
import { publicPageSchemaV1 } from '../../src/shared/schema';
import type { CacheStore } from '../infrastructure/cache/contracts';
import { cacheKey } from '../infrastructure/cache/policy';

export interface PublicSiteSource {
  getPublishedSiteByHandle(handle: string): Promise<Record<string, unknown> | null>;
}

const CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';

function cleanHandle(value: string): string {
  return value.replace(/^@/, '').trim().toLowerCase();
}

function pageFromSite(handle: string, site: Record<string, unknown>): PublicCreatorPage {
  const content = normalizeSiteContent(site);
  return { handle, name: content.displayName || handle, role: content.role || '', bio: content.bio || '', bioAr: content.bioAr || '', avatar: content.avatar || '', coverImage: content.coverImage || '', metaTitle: content.metaTitle || undefined, metaDescription: content.metaDescription || undefined, isPublished: site.isPublished === true, designTokens: content.designTokens, site: content as unknown as Record<string, unknown> };
}

function metadataFor(page: PublicCreatorPage): PublicCreatorMetadata {
  return { title: page.metaTitle || `${page.name} (@${page.handle}) - RALOA Mini-Site`, description: page.metaDescription || page.bio || `Explore ${page.name}'s official links and work on RALOA.`, canonicalPath: `/@${page.handle}`, image: page.avatar || '/social/og-image-1200x630.jpg', robots: page.isPublished ? 'index, follow' : 'noindex, nofollow' };
}

export function createPublicCreatorAdapter(source: PublicSiteSource & { cache?: CacheStore }): PublicCreatorAdapter {
  return {
    cacheControl: CACHE_CONTROL,
    async loadPage(value) {
      const handle = cleanHandle(value);
      if (!/^[a-z0-9_-]{3,30}$/.test(handle)) return null;
      const cached = await source.cache?.get<PublicCreatorPage>(cacheKey('publishedSite', handle));
      if (cached) return cached;
      const site = await source.getPublishedSiteByHandle(handle);
      if (!site) return null;
      const page = pageFromSite(handle, site);
      const normalized = publicPageSchemaV1.parse(page);
      await source.cache?.set(cacheKey('publishedSite', handle), normalized, 60);
      return normalized;
    },
    getMetadata: metadataFor,
    async invalidate(handle) {
      await source.cache?.delete(cacheKey('publishedSite', cleanHandle(handle)));
      await source.cache?.delete(cacheKey('publicMetadata', cleanHandle(handle)));
    }
  };
}
