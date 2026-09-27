import type { Express, Request, Response } from 'express';

type PublishingControllerDependencies = Record<string, any>;

export function registerPublishingControllerRoutes(app: Express, dependencies: PublishingControllerDependencies): void {
  const { isAdminConfigured, getRequestHost, getCachedPublicDomain, getPublishedSiteById, getPublishedSiteByHandle, resolveSiteSlugRedirect, publicCreatorAdapter, publicDemoFixturesEnabled, templatesData, apiError } = dependencies;
  app.get('/api/public/sites/:handle', async (req: Request, res: Response) => {
    const handle = String(req.params.handle || '').trim().toLowerCase();
    if (!/^[a-z0-9_-]{3,30}$/.test(handle)) return res.status(400).json({ error: 'Invalid handle' });
  
    try {
      const customDomainSite = (req as Request & { customDomainSite?: Record<string, unknown> }).customDomainSite;
      let site: Record<string, unknown> | null | undefined = customDomainSite;
      if (!site && isAdminConfigured()) {
        const host = getRequestHost(req);
        const platformHost = host === 'raloa.app' || host === 'www.raloa.app' || host === 'localhost' || host === '127.0.0.1' || host.endsWith('.raloa.app');
        if (!platformHost) {
          const mapping = await getCachedPublicDomain(host);
          const verified = mapping?.verificationStatus === 'verified' && mapping.sslStatus === 'active';
          if (!verified) return res.status(526).json({ error: 'Custom domain verification is pending' });
          site = mapping ? await getPublishedSiteById(mapping.userId, mapping.siteId) : null;
        } else {
          site = await getPublishedSiteByHandle(handle);
          if (!site) {
            const redirect = await resolveSiteSlugRedirect(handle);
            if (redirect?.canonicalSlug && redirect.canonicalSlug !== handle) {
              const target = await getPublishedSiteByHandle(redirect.canonicalSlug);
              if (target) {
                return res.status(308)
                  .set('Location', `/api/public/sites/${redirect.canonicalSlug}`)
                  .json({ redirect: true, from: handle, to: redirect.canonicalSlug });
              }
            }
          }
        }
      }
      if (site) return res.set({ 'Cache-Control': publicCreatorAdapter.cacheControl, Vary: 'Host' }).status(200).json({ site });
  
      if (publicDemoFixturesEnabled) {
      const fixture = templatesData.find((template: any) => template.id.toLowerCase() === handle || template.name.toLowerCase() === handle);
        if (fixture) {
          return res.set({ 'Cache-Control': publicCreatorAdapter.cacheControl, Vary: 'Host' }).status(200).json({
            site: {
              username: handle,
              displayName: fixture.name,
              role: fixture.role,
              bio: fixture.bio,
              bioAr: fixture.bioAr,
              avatar: fixture.avatar,
              coverImage: fixture.coverImage,
              bgStyle: fixture.backgroundStyle || 'signature',
              links: fixture.sampleLinks,
              socials: fixture.socials,
              isPublished: true,
              fixture: true
            }
          });
        }
      }
      if (!isAdminConfigured() && !publicDemoFixturesEnabled) {
        return apiError(res, 503, 'PUBLIC_SITE_UNAVAILABLE', 'Public site data is temporarily unavailable.');
      }
      return apiError(res, 404, 'PUBLIC_SITE_NOT_FOUND', 'Published site not found.');
    } catch (error) {
      console.error('[Public site lookup]', error);
      return res.status(503).json({ error: 'Public site is temporarily unavailable' });
    }
  });
}
