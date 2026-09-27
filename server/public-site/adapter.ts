import { normalizeSiteContent } from '../../src/lib/contentSchema';
import type { PublicCreatorAdapter, PublicCreatorMetadata, PublicCreatorPage } from '../../src/public-site/contract';

export interface PublicSiteSource {
  getPublishedSiteByHandle(handle: string): Promise<Record<string, unknown> | null>;
}

const CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';

function cleanHandle(value: string): string {
  return value.replace(/^@/, '').trim().toLowerCase();
}

function pageFromSite(handle: string, site: Record<string, unknown>): PublicCreatorPage {
  const content = normalizeSiteContent(site);
  return { handle, name: content.displayName || handle, role: content.role || '', bio: content.bio || '', bioAr: content.bioAr || '', avatar: content.avatar || '', coverImage: content.coverImage || '', metaTitle: content.metaTitle || undefined, metaDescription: content.metaDescription || undefined, isPublished: site.isPublished === true, site: content as unknown as Record<string, unknown> };
}

function metadataFor(page: PublicCreatorPage): PublicCreatorMetadata {
  return { title: page.metaTitle || `${page.name} (@${page.handle}) - RALOA Mini-Site`, description: page.metaDescription || page.bio || `Explore ${page.name}'s official links and work on RALOA.`, canonicalPath: `/@${page.handle}`, image: page.avatar || '/social/og-image-1200x630.jpg', robots: page.isPublished ? 'index, follow' : 'noindex, nofollow' };
}

export function createPublicCreatorAdapter(source: PublicSiteSource): PublicCreatorAdapter {
  return {
    cacheControl: CACHE_CONTROL,
    async loadPage(value) {
      const handle = cleanHandle(value);
      if (!/^[a-z0-9_-]{3,30}$/.test(handle)) return null;
      const site = await source.getPublishedSiteByHandle(handle);
      return site ? pageFromSite(handle, site) : null;
    },
    getMetadata: metadataFor
  };
}
