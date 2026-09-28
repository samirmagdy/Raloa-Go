import type { MetadataRoute } from 'next';
import { webConfig } from '@/env';

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/', disallow: ['/studio', '/auth', '/account', '/api'] }, sitemap: `${webConfig.appUrl}/sitemap.xml` };
}
