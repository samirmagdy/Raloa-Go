import type { Express, Request, Response } from 'express';
import type { AuthorizationService } from '../../core/authorization-service';
import type { PolicyAction } from '../../core/authorization-policy';
import type { SitePersistenceRepository } from '../../repositories/site-persistence';

type SitesControllerDependencies = Record<string, any> & {
  sitesRepository: SitePersistenceRepository;
  templatesData: Array<{ id: string }>;
  authorizationService: AuthorizationService;
};

export function registerSitesControllerRoutes(app: Express, dependencies: SitesControllerDependencies): void {
  const { crypto, sitesRepository, getAuthenticatedUser, apiError, isAdminConfigured, normalizeSiteSlug, validateSiteSlug, RESERVED_HANDLES, templatesData, normalizeSiteContent, validateSiteContent, canonicalSiteToLegacy, isSafePublicUrl, validateOwnedMediaReferences, validateSiteEntitlements, entitlementError, auditService, auditRequestId, getPlanCapabilities, normalizeBookingConfig, publicCreatorAdapter, authorizationService } = dependencies;

  async function requireSiteAccess(user: { uid: string }, siteId: string, action: PolicyAction): Promise<boolean> {
    try {
      await authorizationService.requireSite(user, siteId, action);
      return true;
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'RESOURCE_NOT_FOUND' || code === 'TENANT_BOUNDARY_VIOLATION') {
        return false;
      }
      throw error;
    }
  }
  app.get('/api/sites', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
    if (!isAdminConfigured()) return apiError(res, 503, 'SERVICE_NOT_CONFIGURED', 'Site persistence is not configured.');
    try {
      const records = await sitesRepository.listOwned(user.uid, 100);
      const sites = records.map(({ id, data }) => {
        return { id, username: String(data.username || ''), displayName: String(data.displayName || ''), isPublished: data.isPublished === true, updatedAt: data.updatedAt || null };
      }).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
      return res.status(200).json({ sites });
    } catch (error) {
      console.error('[Site list]', error);
      return apiError(res, 503, 'SITE_LIST_FAILED', 'Sites are temporarily unavailable.');
    }
  });
  
  async function siteHandleTaken(handle: string, userId: string, siteId?: string): Promise<boolean> {
    const slug = normalizeSiteSlug(handle);
    if (!validateSiteSlug(slug).valid || RESERVED_HANDLES.has(slug)) return true;
    return sitesRepository.isHandleTaken(slug, userId, siteId);
  }
  
  app.post('/api/sites', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
    if (!isAdminConfigured()) return apiError(res, 503, 'SERVICE_NOT_CONFIGURED', 'Site persistence is not configured.');
    const siteId = String(req.body?.siteId || `site_${crypto.randomUUID()}`).trim();
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(siteId)) return apiError(res, 400, 'INVALID_SITE_ID', 'Invalid site ID.');
    const profile = await sitesRepository.getProfile(user.uid);
    if (!profile) return apiError(res, 404, 'PROFILE_NOT_FOUND', 'User profile not found.');
    if (await sitesRepository.getOwned(user.uid, siteId)) return apiError(res, 409, 'SITE_EXISTS', 'A site with this ID already exists.');
    const incoming = req.body && typeof req.body === 'object' ? req.body : {};
    const username = normalizeSiteSlug(incoming.username);
    const slugValidation = validateSiteSlug(username);
    if (!slugValidation.valid) return apiError(res, 400, slugValidation.code === 'reserved' ? 'RESERVED_HANDLE' : 'INVALID_HANDLE', slugValidation.code === 'reserved' ? 'That site handle is reserved.' : 'A unique site handle is required.');
    if (await siteHandleTaken(username, user.uid, siteId)) return apiError(res, 409, 'HANDLE_IN_USE', 'That site handle is already in use.');
    const requestedTemplateId = typeof incoming.templateId === 'string' ? incoming.templateId.trim() : '';
    if (!requestedTemplateId) return apiError(res, 400, 'TEMPLATE_REQUIRED', 'A template must be selected before creating a site.');
    if (!templatesData.some((template) => template.id === requestedTemplateId)) return apiError(res, 400, 'INVALID_TEMPLATE', 'The selected template does not exist.');
    const site = {
      ...incoming,
      id: siteId,
      userId: user.uid,
      username,
      templateId: requestedTemplateId,
      displayName: typeof incoming.displayName === 'string' ? incoming.displayName : username,
      role: typeof incoming.role === 'string' ? incoming.role : '',
      bio: typeof incoming.bio === 'string' ? incoming.bio : '',
      avatar: typeof incoming.avatar === 'string' ? incoming.avatar : '',
      coverImage: typeof incoming.coverImage === 'string' ? incoming.coverImage : '',
      links: Array.isArray(incoming.links) ? incoming.links : [],
      socials: Array.isArray(incoming.socials) ? incoming.socials : [],
      isPublished: false,
      revision: 1,
      updatedAt: new Date().toISOString()
    } as Record<string, any>;
    const normalizedSite = normalizeSiteContent(site);
    const siteSchema = validateSiteContent(normalizedSite);
    if (!siteSchema.valid) return apiError(res, 400, 'INVALID_SITE_CONTENT', 'Site content does not match the shared content schema.', Object.fromEntries(siteSchema.issues.map((issue: any) => [issue.path, issue.message])));
    Object.assign(site, canonicalSiteToLegacy(normalizedSite));
    if (site.links.some((link: any) => !link || typeof link !== 'object' || typeof link.id !== 'string' || typeof link.title !== 'string' || !isSafePublicUrl(link.url, true))) return apiError(res, 400, 'INVALID_LINKS', 'Every link must have valid text and a safe public URL.');
    const ownedMediaError = await validateOwnedMediaReferences(site, user.uid, siteId);
    if (ownedMediaError) return apiError(res, 400, 'INVALID_MEDIA_REFERENCE', ownedMediaError);
    const entitlement = validateSiteEntitlements(site, profile.data());
    if (entitlement) return entitlementError(res, entitlement.feature, entitlement.message, entitlement.details);
    await sitesRepository.create(user.uid, siteId, site);
    await auditService.recordBestEffort({ actorUserId: user.uid, siteId, resourceType: 'site', resourceId: siteId, action: 'site.created', requestId: auditRequestId(req), metadata: { handle: username, templateId: requestedTemplateId } });
    return res.status(201).json({ site });
  });
  
  app.delete('/api/sites/:siteId', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
    if (!isAdminConfigured()) return apiError(res, 503, 'SERVICE_NOT_CONFIGURED', 'Site persistence is not configured.');
    const siteId = String(req.params.siteId || '').trim();
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(siteId)) return apiError(res, 400, 'INVALID_SITE_ID', 'Invalid site ID.');
    if (!(await requireSiteAccess(user, siteId, 'site:write'))) return apiError(res, 404, 'SITE_NOT_FOUND', 'Site not found.');
    const existing = await sitesRepository.getOwned(user.uid, siteId);
    if (!existing) return apiError(res, 404, 'SITE_NOT_FOUND', 'Site not found.');
    if (existing.data.isPublished === true) return apiError(res, 409, 'SITE_PUBLISHED', 'Unpublish the site before deleting it.');
    if (typeof existing.data.customDomain === 'string' && existing.data.customDomain.trim()) return apiError(res, 409, 'SITE_DOMAIN_ATTACHED', 'Remove the custom domain before deleting the site.');
    await sitesRepository.delete(user.uid, siteId);
    await auditService.recordBestEffort({ actorUserId: user.uid, siteId, resourceType: 'site', resourceId: siteId, action: 'site.deleted', requestId: auditRequestId(req), metadata: { handle: String(existing.data.username || '') } });
    return res.status(204).send();
  });
  
  app.put('/api/sites/:siteId', async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
    if (!isAdminConfigured()) return apiError(res, 503, 'SERVICE_NOT_CONFIGURED', 'Site persistence is not configured.');
    const siteId = String(req.params.siteId || '').trim();
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(siteId)) return apiError(res, 400, 'INVALID_SITE_ID', 'Invalid site ID.');
    if (!(await requireSiteAccess(user, siteId, 'site:write'))) return apiError(res, 404, 'SITE_NOT_FOUND', 'Site not found.');
    const incoming = req.body && typeof req.body === 'object' ? req.body : {};
    const profileData = await sitesRepository.getProfile(user.uid);
    if (!profileData) return apiError(res, 404, 'PROFILE_NOT_FOUND', 'User profile not found.');
    const existing = await sitesRepository.getOwned(user.uid, siteId);
    if (!existing) return apiError(res, 404, 'SITE_NOT_FOUND', 'Site not found.');
    const current = existing.data;
    const expectedRevisionRaw = incoming.expectedRevision;
    const expectedRevision = expectedRevisionRaw === undefined || expectedRevisionRaw === null || expectedRevisionRaw === ''
      ? undefined
      : Number(expectedRevisionRaw);
    if (expectedRevision !== undefined && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)) {
      return apiError(res, 400, 'INVALID_SITE_REVISION', 'The site revision is invalid.');
    }
    const currentRevision = Number.isSafeInteger(Number(current.revision)) && Number(current.revision) >= 0 ? Number(current.revision) : 0;
    if (expectedRevision !== undefined && expectedRevision !== currentRevision) {
      return res.status(409).json({
        status: 'error',
        error: 'SITE_VERSION_CONFLICT',
        code: 'SITE_VERSION_CONFLICT',
        message: 'This site changed elsewhere. Reload the server version before saving again.',
        site: { ...current, id: siteId, userId: user.uid, revision: currentRevision }
      });
    }
    const merged = {
      ...current,
      ...incoming,
      id: siteId,
      userId: user.uid,
      updatedAt: new Date().toISOString()
    } as Record<string, any>;
    const normalizedMerged = normalizeSiteContent(merged);
    const mergedSchema = validateSiteContent(normalizedMerged);
    if (!mergedSchema.valid) return apiError(res, 400, 'INVALID_SITE_CONTENT', 'Site content does not match the shared content schema.', Object.fromEntries(mergedSchema.issues.map((issue: any) => [issue.path, issue.message])));
    Object.assign(merged, canonicalSiteToLegacy(normalizedMerged));
    const handle = normalizeSiteSlug(merged.username);
    const handleValidation = validateSiteSlug(handle);
    if (!handleValidation.valid) return apiError(res, 400, handleValidation.code === 'reserved' ? 'RESERVED_HANDLE' : 'INVALID_HANDLE', handleValidation.code === 'reserved' ? 'That site handle is reserved.' : 'A valid site handle is required before saving a site.');
    if (await siteHandleTaken(handle, user.uid, siteId)) return apiError(res, 409, 'HANDLE_IN_USE', 'That site handle is already in use.');
    merged.username = handle;
    if (typeof merged.displayName !== 'string' || merged.displayName.length > 120 || typeof merged.bio !== 'string' || merged.bio.length > 2000) {
      return apiError(res, 400, 'INVALID_SITE_CONTENT', 'Display name and bio are required and must be within limits.');
    }
    const siteCapabilities = getPlanCapabilities(profileData as any);
    if (!Array.isArray(merged.links) || merged.links.length > siteCapabilities.maxLinks) {
      return entitlementError(res, 'links', `Your current plan allows up to ${siteCapabilities.maxLinks} links.`);
    }
    if (merged.links.some((link) => !link || typeof link !== 'object'
      || typeof link.id !== 'string' || link.id.length > 200
      || typeof link.title !== 'string' || link.title.length > 200
      || !isSafePublicUrl(link.url, true))) {
      return apiError(res, 400, 'INVALID_LINKS', 'Every link must have valid text and a safe public URL.');
    }
    if (merged.socials !== undefined && (!Array.isArray(merged.socials) || merged.socials.some((social) =>
      !social || typeof social.platform !== 'string' || social.platform.length > 40 || typeof social.url !== 'string' || social.url.length > 2000 || !isSafePublicUrl(social.url) || (social.enabled !== undefined && typeof social.enabled !== 'boolean')))) {
      return apiError(res, 400, 'INVALID_SOCIAL_LINKS', 'Every social link must use a safe public URL.');
    }
    if (merged.bookingConfig !== undefined) merged.bookingConfig = normalizeBookingConfig(merged.bookingConfig);
    const allowedKeys = new Set(['id', 'userId', 'username', 'displayName', 'role', 'bio', 'bioAr', 'avatar', 'coverImage', 'templateId', 'bgStyle', 'themeMode', 'links', 'socials', 'isPublished', 'accentColor', 'surfaceColor', 'cardRadius', 'cardShadow', 'borderStyle', 'designTokens', 'customDomain', 'metaTitle', 'metaDescription', 'hidePoweredBy', 'sensitiveWarning', 'ga4Id', 'metaPixelId', 'webhookUrl', 'bookingConfig', 'updatedAt']);
    const sanitized = Object.fromEntries(Object.entries(merged).filter(([key]) => allowedKeys.has(key)));
    sanitized.revision = currentRevision + 1;
    const entitlement = validateSiteEntitlements(sanitized, profileData);
    if (entitlement) return entitlementError(res, entitlement.feature, entitlement.message, entitlement.details);
    const ownedMediaError = await validateOwnedMediaReferences(sanitized, user.uid, siteId);
    if (ownedMediaError) return apiError(res, 400, 'INVALID_MEDIA_REFERENCE', ownedMediaError);
    if (sanitized.isPublished === true && (!sanitized.username || !sanitized.displayName || !sanitized.bio)) {
      return apiError(res, 400, 'PUBLISH_REQUIREMENTS_NOT_MET', 'Complete your handle, display name, and bio before publishing.');
    }
    const previousHandle = normalizeSiteSlug(current.username);
    const saved = await sitesRepository.saveVersioned({ userId: user.uid, siteId, site: sanitized, previousHandle, nextHandle: handle, expectedRevision });
    if (saved.status === 'handle_redirect_conflict') return apiError(res, 409, 'HANDLE_REDIRECT_CONFLICT', 'The previous site handle is already reserved by another site.');
    if (saved.status === 'site_not_found') return apiError(res, 404, 'SITE_NOT_FOUND', 'Site not found.');
    if (saved.status === 'version_conflict') {
      const latestData = saved.site || {};
      return res.status(409).json({ status: 'error', error: 'SITE_VERSION_CONFLICT', code: 'SITE_VERSION_CONFLICT', message: 'This site changed elsewhere. Reload the server version before saving again.', site: { ...latestData, id: siteId, userId: user.uid, revision: Number(latestData.revision || 0) } });
    }
    await Promise.all([publicCreatorAdapter.invalidate(handle), previousHandle && previousHandle !== handle ? publicCreatorAdapter.invalidate(previousHandle) : Promise.resolve()]);
    const publicationChanged = Boolean(current.isPublished) !== Boolean(sanitized.isPublished);
    await auditService.recordBestEffort({
      actorUserId: user.uid, siteId, resourceType: 'site', resourceId: siteId,
      action: publicationChanged ? (sanitized.isPublished ? 'site.published' : 'site.unpublished') : 'site.updated',
      requestId: auditRequestId(req),
      metadata: { fromPublished: Boolean(current.isPublished), toPublished: Boolean(sanitized.isPublished), handle, revision: sanitized.revision }
    });
    return res.status(200).json({ site: sanitized });
  });
  
}
