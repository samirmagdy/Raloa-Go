import { z } from 'zod';
import { normalizeSiteContent } from '../../lib/contentSchema';

export const SCHEMA_VERSION = 1 as const;
export const schemaVersion = z.literal(SCHEMA_VERSION);

export const designTokensSchema = z.object({
  accentColor: z.string(), surfaceColor: z.string(), cardRadius: z.enum(['sharp', 'subtle', 'rounded', 'pill']),
  cardShadow: z.enum(['none', 'subtle', 'soft', 'hard']), borderStyle: z.enum(['none', 'thin', 'bold', 'dashed']),
  themeMode: z.enum(['auto', 'dark', 'light']), typography: z.object({ fontFamily: z.enum(['sans', 'serif', 'mono']), headingScale: z.enum(['compact', 'standard', 'large']), bodyScale: z.enum(['compact', 'standard', 'large']), headingWeight: z.union([z.literal(700), z.literal(800), z.literal(900)]), bodyWeight: z.union([z.literal(400), z.literal(500), z.literal(600)]) }),
  background: z.object({ style: z.enum(['signature', 'banner', 'immersive', 'gradient', 'minimal']), coverImage: z.string(), coverPosition: z.enum(['center', 'top', 'bottom']), overlay: z.enum(['none', 'soft', 'strong']) }),
  layout: z.object({ contentWidth: z.enum(['compact', 'standard', 'wide']), cardGap: z.enum(['tight', 'standard', 'spacious']), sectionSpacing: z.enum(['tight', 'standard', 'spacious']), horizontalPadding: z.enum(['tight', 'standard', 'wide']) })
});

export const siteConfigSchemaV1 = z.object({
  username: z.string(), displayName: z.string(), role: z.string(), bio: z.string(), bioAr: z.string(), avatar: z.string(), coverImage: z.string(),
  designTokens: designTokensSchema, links: z.array(z.record(z.string(), z.unknown())), socials: z.array(z.record(z.string(), z.unknown())), isPublished: z.boolean(),
  metaTitle: z.string(), metaDescription: z.string(), bookingConfig: z.record(z.string(), z.unknown())
}).passthrough();
export const persistedSiteSchemaV1 = z.object({ schemaVersion: schemaVersion, data: siteConfigSchemaV1 });

export const publicPageSchemaV1 = z.object({ handle: z.string(), name: z.string(), role: z.string(), bio: z.string(), bioAr: z.string(), avatar: z.string(), coverImage: z.string(), isPublished: z.boolean(), designTokens: designTokensSchema, site: z.record(z.string(), z.unknown()) }).passthrough();
export const domainEventSchemaV1 = z.object({ id: z.string(), type: z.string().regex(/^[A-Za-z][A-Za-z0-9]*\.v1$/), name: z.string(), version: z.literal(1), aggregateType: z.string(), aggregateId: z.string(), occurredAt: z.string().datetime(), payload: z.record(z.string(), z.unknown()) });
export const oauthTokenBundleSchemaV1 = z.object({ accessToken: z.string().min(1), refreshToken: z.string().min(1).optional(), expiresAt: z.number().finite().optional() });
export const integrationConnectionSchemaV1 = z.object({ provider: z.string().min(1), scopes: z.array(z.string()), state: z.enum(['connected', 'refreshing', 'reauthorization_required', 'revoked', 'error']) });
export const analyticsEventSchemaV1 = z.object({
  schemaVersion: schemaVersion,
  eventId: z.string().trim().min(8).max(200),
  eventType: z.enum(['page_view', 'link_click']),
  siteId: z.string().trim().min(1).max(200),
  siteOwnerId: z.string().trim().min(1).max(200).optional(),
  occurredAt: z.string().datetime(),
  visitorHash: z.string().trim().min(1).max(256).optional(),
  dimensions: z.record(z.string(), z.string().max(500)).default({}),
  payload: z.record(z.string(), z.unknown()).default({})
});
export const normalizedEntitlementSchema = z.object({
  maxLinks: z.number().int().nonnegative().nullable(),
  maxMedia: z.number().int().nonnegative().nullable(),
  maxUploadBytes: z.number().int().positive(),
  premiumTemplates: z.boolean(),
  analytics: z.boolean(),
  removeBranding: z.boolean(),
  customDomains: z.boolean(),
  studioControls: z.boolean(),
  allowedBackgroundStyles: z.array(z.string()),
  allowedBlockTypes: z.array(z.string()),
  allowedDesignOptions: z.object({ cardRadius: z.array(z.string()), cardShadow: z.array(z.string()), borderStyle: z.array(z.string()) })
});

export const publicApiPayloadSchemas = {
  contact: z.object({ name: z.string().trim().min(1).max(120), email: z.string().email(), message: z.string().trim().min(1).max(5000) }),
  newsletter: z.object({ email: z.string().email() }),
  pageView: z.object({ path: z.string().startsWith('/'), eventId: z.string().optional(), visitorId: z.string().optional() }).passthrough(),
  linkClick: z.object({ linkId: z.string().min(1), url: z.string().url(), siteHandle: z.string().optional(), eventId: z.string().optional() }).passthrough()
} as const;

export const workerPayloadSchemas = {
  email_delivery: z.object({ bookingId: z.string().optional(), eventId: z.string().optional() }).passthrough(),
  calendar_sync: z.object({ bookingId: z.string().optional(), eventId: z.string().optional() }).passthrough(),
  analytics_rollup: z.object({ eventId: z.string().optional() }).passthrough(),
  oauth_refresh: z.object({ eventId: z.string().optional(), provider: z.string().optional() }).passthrough(),
  order_processing: z.object({ orderId: z.string().optional(), eventId: z.string().optional() }).passthrough(),
  domain_verification: z.object({ domainId: z.string().optional(), eventId: z.string().optional() }).passthrough(),
  media_processing: z.object({ mediaId: z.string().optional(), eventId: z.string().optional() }).passthrough(),
  stripe_reconciliation: z.object({ eventId: z.string().optional() }).passthrough(),
  cleanup: z.object({ eventId: z.string().optional() }).passthrough()
} as const;
export * from './api';

export type SiteConfigV1 = z.infer<typeof siteConfigSchemaV1>;
export type PublicPageV1 = z.infer<typeof publicPageSchemaV1>;
export type DomainEventV1 = z.infer<typeof domainEventSchemaV1>;
export type OAuthTokenBundleV1 = z.infer<typeof oauthTokenBundleSchemaV1>;
export type AnalyticsEventV1 = z.infer<typeof analyticsEventSchemaV1>;
export type NormalizedEntitlement = z.infer<typeof normalizedEntitlementSchema>;

export function migrateSiteConfig(input: unknown): SiteConfigV1 {
  const candidate = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const versioned = candidate.schemaVersion === SCHEMA_VERSION && candidate.data ? candidate.data : candidate;
  return siteConfigSchemaV1.parse(normalizeSiteContent(versioned));
}

export function validateWorkerPayload(kind: keyof typeof workerPayloadSchemas, payload: unknown): Record<string, unknown> {
  return workerPayloadSchemas[kind].parse(payload);
}
