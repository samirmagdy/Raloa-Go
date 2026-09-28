import type { MetadataRoute } from 'next';
import { listPublicSiteHandles } from '@/server/public-sites';
import { webConfig } from '@/env';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sites = await listPublicSiteHandles();
  return [{ url: webConfig.appUrl, changeFrequency: 'daily', priority: 1 }, ...sites.map((site) => ({ url: `${webConfig.appUrl}/@${site.handle}`, lastModified: site.updatedAt, changeFrequency: 'weekly' as const, priority: 0.7 }))];
}
