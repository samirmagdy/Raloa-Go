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

export const schemaVersioned = <T extends z.ZodType>(data: T) => z.object({ schemaVersion, data });

export const mediaGalleryItemSchemaV1 = z.object({
  id: z.string().min(1).max(128),
  src: z.string().max(4000),
  thumbnail: z.string().max(4000).optional(),
  alt: z.string().max(300).optional(),
  caption: z.string().max(500).optional(),
  type: z.enum(['image', 'video']).optional()
}).passthrough();

export const contentBlockSchemaV1 = z.object({
  id: z.string().min(1).max(128),
  title: z.string().max(200),
  titleAr: z.string().max(200).optional(),
  subtitle: z.string().max(500).optional(),
  subtitleAr: z.string().max(500).optional(),
  url: z.string().max(4000),
  type: z.enum(['link', 'gallery', 'booking', 'shop', 'video', 'music', 'contact', 'newsletter', 'header']),
  thumbnail: z.string().max(4000).optional(),
  galleryItems: z.array(mediaGalleryItemSchemaV1).max(50).optional()
}).passthrough();

export const socialLinkSchemaV1 = z.object({
  platform: z.string().min(1).max(40),
  url: z.string().max(2000),
  enabled: z.boolean().optional()
}).passthrough();

export const bookingServiceSchemaV1 = z.object({
  id: z.string().regex(/^[a-z0-9_-]{1,64}$/),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  durationMinutes: z.number().int().min(15).max(480),
  bufferMinutes: z.number().int().min(0).max(120).optional()
}).passthrough();

export const availabilityWindowSchemaV1 = z.object({
  enabled: z.boolean(),
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
});

export const bookingConfigSchemaV1 = z.object({
  enabled: z.boolean(),
  timezone: z.string().min(1).max(100),
  services: z.array(bookingServiceSchemaV1).max(50),
  weeklyAvailability: z.record(z.string(), availabilityWindowSchemaV1),
  blackoutDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(366),
  minNoticeMinutes: z.number().int().min(0).max(10080),
  bookingWindowDays: z.number().int().min(1).max(365),
  bufferMinutes: z.number().int().min(0).max(120),
  maxBookingsPerDay: z.number().int().min(1).max(100),
  calendarProvider: z.enum(['none', 'google', 'outlook']).optional()
}).passthrough();

export const siteConfigSchemaV1 = z.object({
  username: z.string(), displayName: z.string(), role: z.string(), bio: z.string(), bioAr: z.string(), avatar: z.string(), coverImage: z.string(),
  designTokens: designTokensSchema, links: z.array(contentBlockSchemaV1), socials: z.array(socialLinkSchemaV1), isPublished: z.boolean(),
  metaTitle: z.string(), metaDescription: z.string(), bookingConfig: bookingConfigSchemaV1
}).passthrough();
export const persistedSiteSchemaV1 = z.object({ schemaVersion: schemaVersion, data: siteConfigSchemaV1 });

export const siteConfigPayloadSchemaV1 = siteConfigSchemaV1.extend({
  id: z.string().optional(),
  revision: z.number().int().nonnegative().optional(),
  customDomain: z.string().max(253).optional(),
  hidePoweredBy: z.boolean().optional(),
  sensitiveWarning: z.boolean().optional(),
  ga4Id: z.string().max(100).optional(),
  metaPixelId: z.string().max(100).optional(),
  webhookUrl: z.string().max(2000).optional()
}).passthrough();

export const productSchemaV1 = z.object({
  id: z.string().min(1).max(128),
  creatorId: z.string().min(1).max(200),
  siteId: z.string().min(1).max(200).optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(2000),
  imageUrls: z.array(z.string().max(4000)).max(8),
  priceMinor: z.number().int().min(0).max(10_000_000),
  currency: z.string().regex(/^[a-z]{3}$/),
  active: z.boolean(),
  inventory: z.number().int().nonnegative().nullable(),
  inventoryReserved: z.number().int().nonnegative().default(0),
  stripeProductId: z.string().optional(),
  stripePriceId: z.string().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional()
}).passthrough();

export const productWriteRequestSchemaV1 = productSchemaV1.omit({ id: true, creatorId: true, createdAt: true, updatedAt: true }).partial({ inventoryReserved: true, stripeProductId: true, stripePriceId: true });

export const bookingCreateRequestSchemaV1 = z.object({
  hostHandle: z.string().regex(/^[a-z0-9_-]{3,30}$/),
  serviceId: z.string().regex(/^[a-z0-9_-]{1,64}$/),
  slotStart: z.string().datetime(),
  slotEnd: z.string().datetime(),
  customerName: z.string().trim().min(1).max(120),
  customerEmail: z.string().email().max(320),
  notes: z.string().max(2000).optional(),
  idempotencyKey: z.string().trim().min(16).max(200)
}).passthrough();

export const bookingSchemaV1 = bookingCreateRequestSchemaV1.extend({
  id: z.string().min(1).max(200),
  siteId: z.string().min(1).max(200),
  hostUserId: z.string().min(1).max(200),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).passthrough();

export const publicPageSchemaV1 = z.object({ handle: z.string(), name: z.string(), role: z.string(), bio: z.string(), bioAr: z.string(), avatar: z.string(), coverImage: z.string(), isPublished: z.boolean(), designTokens: designTokensSchema, site: z.record(z.string(), z.unknown()) }).passthrough();
export const publicProfilePayloadSchemaV1 = publicPageSchemaV1.extend({
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  links: z.array(contentBlockSchemaV1).optional(),
  socials: z.array(socialLinkSchemaV1).optional(),
  products: z.array(productSchemaV1).optional(),
  bookingConfig: bookingConfigSchemaV1.optional()
});
export const domainEventSchemaV1 = z.object({ id: z.string(), type: z.string().regex(/^[A-Za-z][A-Za-z0-9]*\.v1$/), name: z.string(), version: z.literal(1), aggregateType: z.string(), aggregateId: z.string(), occurredAt: z.string().datetime(), payload: z.record(z.string(), z.unknown()) });
const eventIdentity = { siteId: z.string().min(1).max(200).optional() };
export const domainEventPayloadSchemasV1 = {
  SitePublished: z.object({ ...eventIdentity, siteId: z.string().min(1).max(200), handle: z.string().min(1).max(253), revision: z.number().int().nonnegative().optional() }).passthrough(),
  BookingCreated: z.object({ ...eventIdentity, bookingId: z.string().min(1).max(200), hostUserId: z.string().min(1).max(200), siteId: z.string().min(1).max(200) }).passthrough(),
  BookingCancelled: z.object({ ...eventIdentity, bookingId: z.string().min(1).max(200), siteId: z.string().min(1).max(200), reason: z.string().max(500).optional() }).passthrough(),
  OrderCreated: z.object({ ...eventIdentity, orderId: z.string().min(1).max(200), productId: z.string().min(1).max(200), siteId: z.string().min(1).max(200), creatorId: z.string().min(1).max(200) }).passthrough(),
  OrderPaid: z.object({ ...eventIdentity, orderId: z.string().min(1).max(200), siteId: z.string().min(1).max(200), paymentReference: z.string().max(300).optional() }).passthrough(),
  OrderFulfilled: z.object({ ...eventIdentity, orderId: z.string().min(1).max(200), siteId: z.string().min(1).max(200), fulfillmentReference: z.string().max(300).optional() }).passthrough(),
  SubscriptionChanged: z.object({ ...eventIdentity, accountId: z.string().min(1).max(200), plan: z.string().min(1).max(80), status: z.string().min(1).max(80), entitlementVersion: z.number().int().nonnegative().optional() }).passthrough(),
  DomainVerified: z.object({ ...eventIdentity, domainId: z.string().min(1).max(200), hostname: z.string().min(1).max(253), sslStatus: z.enum(['pending', 'active', 'failed']) }).passthrough(),
  MediaUploaded: z.object({ ...eventIdentity, mediaId: z.string().min(1).max(200), siteId: z.string().min(1).max(200), lifecycle: z.enum(['uploaded', 'processing', 'ready', 'failed']).optional() }).passthrough(),
  IntegrationDisconnected: z.object({ ...eventIdentity, connectionId: z.string().min(1).max(200), provider: z.string().min(1).max(80), siteId: z.string().min(1).max(200).optional(), reason: z.string().max(500).optional() }).passthrough()
} as const;
export type DomainEventNameV1 = keyof typeof domainEventPayloadSchemasV1;
export function validateDomainEventPayloadV1(name: DomainEventNameV1, payload: unknown): Record<string, unknown> {
  return domainEventPayloadSchemasV1[name].parse(payload);
}
export const outboxEventSchemaV1 = z.object({
  id: z.string().min(1), eventType: z.string().regex(/^[A-Za-z][A-Za-z0-9]*\.v1$/), aggregateType: z.string().min(1), aggregateId: z.string().min(1), idempotencyKey: z.string().min(1), payload: z.record(z.string(), z.unknown()),
  status: z.enum(['pending', 'publishing', 'published', 'retry', 'dead_letter']), attempts: z.number().int().nonnegative(), maxAttempts: z.number().int().positive(), availableAt: z.string().datetime(), leaseUntil: z.string().datetime().optional(), lastError: z.string().optional(), createdAt: z.string().datetime(), updatedAt: z.string().datetime(), publishedAt: z.string().datetime().optional()
}).passthrough();
export const providerEventSchemaV1 = z.object({
  provider: z.enum(['stripe', 'cloudflare', 'google_calendar', 'microsoft_graph', 'firebase_auth', 'email', 'storage']),
  eventId: z.string().min(1).max(300),
  eventType: z.string().min(1).max(200),
  occurredAt: z.string().datetime().optional(),
  data: z.record(z.string(), z.unknown()),
  signatureVerified: z.boolean().default(false)
}).passthrough();
export const stripeProviderEventSchemaV1 = providerEventSchemaV1.extend({
  provider: z.literal('stripe'),
  data: z.object({ object: z.record(z.string(), z.unknown()).optional() }).passthrough()
});
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
  email_delivery: z.object({ bookingId: z.string().optional(), eventId: z.string().optional(), notificationId: z.string().optional() }).passthrough(),
  calendar_sync: z.object({ bookingId: z.string().optional(), eventId: z.string().optional(), connectionId: z.string().optional() }).passthrough(),
  analytics_rollup: z.object({ eventId: z.string().optional(), siteId: z.string().optional(), occurredBefore: z.string().datetime().optional() }).passthrough(),
  oauth_refresh: z.object({ eventId: z.string().optional(), provider: z.string().optional(), connectionId: z.string().optional() }).passthrough(),
  order_processing: z.object({ orderId: z.string().optional(), eventId: z.string().optional() }).passthrough(),
  domain_verification: z.object({ domainId: z.string().optional(), eventId: z.string().optional(), domain: z.string().optional() }).passthrough(),
  media_processing: z.object({ mediaId: z.string().optional(), eventId: z.string().optional(), assetId: z.string().optional() }).passthrough(),
  stripe_reconciliation: z.object({ eventId: z.string().optional(), customerId: z.string().optional(), subscriptionId: z.string().optional() }).passthrough(),
  cleanup: z.object({ eventId: z.string().optional(), olderThan: z.string().datetime().optional() }).passthrough()
} as const;

export const backgroundJobSchemaV1 = z.object({
  id: z.string().min(1).max(200),
  kind: z.enum(['calendar_sync', 'email_delivery', 'domain_verification', 'oauth_refresh', 'analytics_rollup', 'media_processing', 'stripe_reconciliation', 'order_processing', 'cleanup']),
  payload: z.record(z.string(), z.unknown()),
  idempotencyKey: z.string().min(1).max(300),
  status: z.enum(['pending', 'processing', 'retry', 'completed', 'dead_letter']),
  attempts: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  availableAt: z.string().datetime(),
  leaseUntil: z.string().datetime().optional(),
  lastError: z.string().max(2000).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  deadLetteredAt: z.string().datetime().optional()
}).passthrough();
export * from './api';

export type SiteConfigV1 = z.infer<typeof siteConfigSchemaV1>;
export type SiteConfigPayloadV1 = z.infer<typeof siteConfigPayloadSchemaV1>;
export type DesignTokensV1 = z.infer<typeof designTokensSchema>;
export type ContentBlockV1 = z.infer<typeof contentBlockSchemaV1>;
export type ProductV1 = z.infer<typeof productSchemaV1>;
export type BookingV1 = z.infer<typeof bookingSchemaV1>;
export type BookingCreateRequestV1 = z.infer<typeof bookingCreateRequestSchemaV1>;
export type PublicPageV1 = z.infer<typeof publicPageSchemaV1>;
export type PublicProfilePayloadV1 = z.infer<typeof publicProfilePayloadSchemaV1>;
export type DomainEventV1 = z.infer<typeof domainEventSchemaV1>;
export type OutboxEventV1 = z.infer<typeof outboxEventSchemaV1>;
export type ProviderEventV1 = z.infer<typeof providerEventSchemaV1>;
export type BackgroundJobV1 = z.infer<typeof backgroundJobSchemaV1>;
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

export function validateBackgroundJob(input: unknown): BackgroundJobV1 {
  return backgroundJobSchemaV1.parse(input);
}
