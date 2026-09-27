import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import type { DocumentData, DocumentReference, DocumentSnapshot, Query, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import multer from 'multer';
import sharp from 'sharp';
import {
  APP_URL,
  adminDb,
  adminAuth,
  adminStorage,
  stripe,
  cloudflareRequest,
  getBillingDetails,
  getAuthoritativeBillingState,
  reconcileStripeBillingState,
  deleteDomain,
  findDomainByHostname,
  findDomainById,
  getCheckoutSessionStatus,
  getPublishedSiteById,
  getPublishedSiteByHandle,
  resolveSiteSlugRedirect,
  getCloudflareConfig,
  getPriceId,
  handleStripeWebhook,
  isAdminConfigured,
  isStripeConfigured,
  saveDomain,
  verifyBearerToken,
  type AuthenticatedUser,
  type DomainRecord
} from './server-services';
import { templatesData } from './src/data/content';
import { getPlanCapabilities, getPlanTier, isPremiumTemplate } from './src/lib/planCapabilities';
import { calendarAdapter, calendarOAuthConfiguration, calendarProviderIsConfigured, decryptCalendarTokens, encryptCalendarTokens, type CalendarProvider, type CalendarBookingEvent, type CalendarTokenBundle } from './server-calendar';
import { isSupportedBlockType, isSupportedEmbedUrl } from './src/lib/blockTypes';
import { canonicalSiteToLegacy, normalizeBookingConfig, normalizeProductInput, normalizeSiteContent, validateProductInput, validateSiteContent } from './src/lib/contentSchema';
import type { BookingConfig, BookingServiceConfig } from './src/types';
import { normalizeSiteSlug, RESERVED_SITE_SLUGS, validateSiteSlug } from './src/lib/siteSlug';
import { createDomainModules } from './server/modules';
import { calendarProviders } from './server/adapters/calendar';
import { oauthProviderAdapters } from './server/adapters/oauth';
import { stripeAdapter } from './server/adapters/stripe';
import { cloudflareAdapter } from './server/adapters/cloudflare';
import { createBillingController } from './server/domains/billing/controller';
import { createEntitlementService } from './server/domains/billing/entitlement-service';
import { buildRateLimitKey, RATE_LIMIT_POLICIES, type RateLimitIdentity, type RateLimitPolicyName } from './server/core/rate-limit-policy';
import { assertOrderTransition, legacyOrderState } from './server/domains/orders/state-machine';
import { createBackgroundJobService, createConfiguredDispatcher, createFirestoreBackgroundJobRepository, type JobKind } from './server/background-jobs';
import { appendOutboxEvent, createFirestoreOutboxRepository, createOutboxEvent, createOutboxService, outboxEventId } from './server/outbox';
import { createDomainEventBus, DOMAIN_EVENTS, eventType, type DomainEvent } from './server/events';
import { createPublicCreatorAdapter } from './server/public-site';
import { MemoryCacheStore } from './server/infrastructure/cache/memory';
import { cacheKey } from './server/infrastructure/cache/policy';
import { apiErrorSchema } from './src/shared/schema';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Composition root for bounded contexts. The legacy handlers below remain the
// compatibility shell while routes are migrated to module controllers.
export const domainModules = createDomainModules(adminDb, {
  resolvePublicSite: (handle) => getPublishedSiteByHandle(handle),
  billing: stripeAdapter,
  cloudflare: cloudflareAdapter,
  oauthAdapters: oauthProviderAdapters(),
  providers: calendarProviders()
});
const entitlementService = createEntitlementService({ billing: getAuthoritativeBillingState });
const publicCache = new MemoryCacheStore();
export const publicCreatorAdapter = createPublicCreatorAdapter({ getPublishedSiteByHandle, cache: publicCache });
async function getCachedPublicDomain(hostname: string): Promise<DomainRecord | null> {
  const normalized = hostname.trim().toLowerCase();
  const key = cacheKey('domainResolution', normalized);
  const cached = await publicCache.get<DomainRecord>(key);
  if (cached) return cached;
  const domain = await findDomainByHostname(normalized);
  if (domain) await publicCache.set(key, domain, 30);
  return domain;
}
export const backgroundJobs = createBackgroundJobService(createFirestoreBackgroundJobRepository(adminDb), createConfiguredDispatcher(), {
  email_delivery: async () => processPendingBookingNotifications(),
  calendar_sync: async () => processPendingCalendarJobs(),
  media_processing: async () => sweepOrphanMedia(),
  cleanup: async () => sweepOrphanMedia(),
  stripe_reconciliation: async () => { await reconcileStripeBillingState(); },
  order_processing: async () => undefined,
  domain_verification: async () => undefined,
  oauth_refresh: async () => undefined,
  analytics_rollup: async () => undefined
});
export const domainEventBus = createDomainEventBus();
const enqueueEventJobs = (kind: JobKind) => async (event: DomainEvent): Promise<void> => { await backgroundJobs.enqueue({ kind, idempotencyKey: `event:${event.id}:${kind}`, payload: { ...event.payload, eventId: event.id, eventType: event.type } }); };
domainEventBus.subscribe(DOMAIN_EVENTS.BookingCreated, enqueueEventJobs('email_delivery'));
domainEventBus.subscribe(DOMAIN_EVENTS.BookingCreated, enqueueEventJobs('calendar_sync'));
domainEventBus.subscribe(DOMAIN_EVENTS.BookingConfirmed, enqueueEventJobs('email_delivery'));
domainEventBus.subscribe(DOMAIN_EVENTS.BookingConfirmed, enqueueEventJobs('calendar_sync'));
domainEventBus.subscribe(DOMAIN_EVENTS.BookingCancelled, enqueueEventJobs('email_delivery'));
domainEventBus.subscribe(DOMAIN_EVENTS.BookingCancelled, enqueueEventJobs('calendar_sync'));
domainEventBus.subscribe(DOMAIN_EVENTS.OrderCreated, enqueueEventJobs('order_processing'));
domainEventBus.subscribe(DOMAIN_EVENTS.AnalyticsRecorded, enqueueEventJobs('analytics_rollup'));
domainEventBus.subscribe(DOMAIN_EVENTS.IntegrationSynchronized, enqueueEventJobs('oauth_refresh'));
export const outbox = createOutboxService(createFirestoreOutboxRepository(adminDb), {
  publish: async (event) => {
    const [name, version] = event.eventType.split('.v');
    await domainEventBus.publish({ id: event.id, type: event.eventType, name: name as DomainEvent['name'], version: Number(version || 1) as 1, aggregateType: event.aggregateType, aggregateId: event.aggregateId, occurredAt: event.createdAt, payload: event.payload });
  }
});
const billingController = createBillingController(domainModules.billing.service, (request) => getAuthenticatedUser(request));
const trustedProxyHops = Number(process.env.TRUSTED_PROXY_HOPS || 1);
app.set('trust proxy', Number.isInteger(trustedProxyHops) && trustedProxyHops >= 0 ? trustedProxyHops : 1);
const PORT = Number(process.env.PORT) || 3000;
const AUTH_SESSION_SECRET = process.env.AUTH_SESSION_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'local-development-session-secret');
// Local auth and fixture data are opt-in seams for local development/tests.
// They must never become the default behavior of a deployed environment.
const localAuthEnabled = process.env.NODE_ENV === 'test' || process.env.LOCAL_AUTH_ENABLED === 'true';
const publicDemoFixturesEnabled = process.env.ENABLE_DEMO_FIXTURES === 'true' && process.env.NODE_ENV !== 'production';
const LOCAL_ACCOUNT_SETTINGS = new Map<string, Record<string, unknown>>();

const DEFAULT_NOTIFICATION_PREFERENCES = {
  productUpdates: true,
  billing: true,
  domains: true,
  bookings: true,
  orders: true,
  referrals: true,
  analyticsSummary: false,
  security: true
};
const DEFAULT_NOTIFICATION_CHANNELS = { email: true, inApp: true };
const DEFAULT_PRIVACY_PREFERENCES = {
  profilePublished: true,
  searchIndexing: true,
  analyticsCollection: true
};

app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id']?.toString() || crypto.randomUUID();
  const startedAt = Date.now();
  res.setHeader('X-Request-ID', requestId);
  res.on('finish', () => {
    if (req.path.startsWith('/assets/')) return;
    console.log(JSON.stringify({
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
      timestamp: new Date().toISOString()
    }));
  });
  next();
});

app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'];
  if (typeof signature !== 'string') return res.status(400).json({ error: 'Missing Stripe signature' });

  try {
    await handleStripeWebhook(req.body as Buffer, signature);
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('[Stripe webhook]', error);
    return res.status(400).json({ error: 'Webhook verification failed' });
  }
});

// Body parsing middleware for API endpoints
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Keep one machine-readable error contract while retaining the legacy
// `status`/`message` fields during the migration of existing callers.
app.use((_req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json.bind(res);
  res.json = ((body: any) => {
    if (res.statusCode >= 400 && body && typeof body === 'object') {
      const legacyMessage = typeof body.message === 'string' ? body.message : 'Request failed';
      const legacyError = typeof body.error === 'string' ? body.error : '';
      const code = typeof body.code === 'string'
        ? body.code
        : (legacyError || legacyMessage).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'REQUEST_FAILED';
      body = {
        ...body,
        error: { code, message: legacyMessage, ...(body.fields ? { fields: body.fields } : {}) },
        errorCode: code
      };
    }
    return originalJson(body);
  }) as Response['json'];
  next();
});

type PublicRateBucket = { startedAt: number; count: number };
const PUBLIC_RATE_LIMITS = new Map<string, PublicRateBucket>();
const LOCAL_IDEMPOTENCY = new Map<string, { response: Record<string, unknown>; createdAt: number }>();

function clientIdentity(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

async function enforcePublicRateLimit(req: Request, key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; retryAfter: number }> {
  const identity = `${key}:${clientIdentity(req)}`;
  if (isAdminConfigured()) return consumeDistributedRateLimit(identity, limit, windowMs);
  const now = Date.now();
  const current = PUBLIC_RATE_LIMITS.get(identity);
  const bucket = !current || now - current.startedAt >= windowMs ? { startedAt: now, count: 0 } : current;
  const allowed = bucket.count < limit;
  if (allowed) bucket.count += 1;
  PUBLIC_RATE_LIMITS.set(identity, bucket);
  return { allowed, retryAfter: Math.max(1, Math.ceil((bucket.startedAt + windowMs - now) / 1000)) };
}

async function enforceRateLimitPolicy(policyName: RateLimitPolicyName, identity: RateLimitIdentity): Promise<{ allowed: boolean; retryAfter: number }> {
  const policy = RATE_LIMIT_POLICIES[policyName];
  const key = buildRateLimitKey(policyName, identity);
  if (isAdminConfigured()) return consumeDistributedRateLimit(key, policy.limit, policy.windowMs);
  const now = Date.now();
  const current = PUBLIC_RATE_LIMITS.get(key);
  const bucket = !current || now - current.startedAt >= policy.windowMs ? { startedAt: now, count: 0 } : current;
  const allowed = bucket.count < policy.limit;
  if (allowed) bucket.count += 1;
  PUBLIC_RATE_LIMITS.set(key, bucket);
  return { allowed, retryAfter: Math.max(1, Math.ceil((bucket.startedAt + policy.windowMs - now) / 1000)) };
}

function apiError(res: Response, status: number, code: string, message: string, fields?: Record<string, string>) {
  const body = apiErrorSchema.parse({
    status: 'error',
    error: code,
    code,
    message,
    ...(fields ? { fields } : {})
  });
  return res.status(status).json(body);
}

async function claimIdempotency(scope: string, key: string): Promise<{ replay: boolean; inProgress?: boolean; response?: Record<string, unknown> }> {
  const normalized = key.trim();
  if (!normalized || normalized.length > 200) throw new Error('INVALID_IDEMPOTENCY_KEY');
  const id = crypto.createHash('sha256').update(`${scope}:${normalized}`).digest('hex');
  if (!isAdminConfigured()) {
    const existing = LOCAL_IDEMPOTENCY.get(id);
    if (existing && Date.now() - existing.createdAt < 24 * 60 * 60 * 1000) return { replay: true, response: existing.response };
    return { replay: false };
  }
  const ref = adminDb.collection('idempotency_keys').doc(id);
  let replay = false;
  let response: Record<string, unknown> | undefined;
  await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists) {
      const data = snapshot.data() || {};
      const createdAt = Date.parse(String(data.createdAt || ''));
      if (data.status === 'completed' || (data.status === 'processing' && createdAt > Date.now() - 10 * 60 * 1000)) {
        replay = true;
        response = data.response as Record<string, unknown> | undefined;
        return;
      }
    }
    transaction.set(ref, { scope, status: 'processing', createdAt: new Date().toISOString(), response: null }, { merge: true });
  });
  return { replay, inProgress: replay && !response, response };
}

async function completeIdempotency(scope: string, key: string, response: Record<string, unknown>): Promise<void> {
  const id = crypto.createHash('sha256').update(`${scope}:${key.trim()}`).digest('hex');
  if (!isAdminConfigured()) {
    LOCAL_IDEMPOTENCY.set(id, { response, createdAt: Date.now() });
    return;
  }
  await adminDb.collection('idempotency_keys').doc(id).set({ scope, status: 'completed', response, completedAt: new Date().toISOString() }, { merge: true });
}

// Read base index.html template from dist if built, or fallback to root index.html
const distIndexPath = path.resolve(__dirname, 'dist', 'index.html');
const rootIndexPath = path.resolve(__dirname, 'index.html');
function getIndexHtml(): string {
  if (fs.existsSync(distIndexPath)) {
    return fs.readFileSync(distIndexPath, 'utf-8');
  }
  if (fs.existsSync(rootIndexPath)) {
    return fs.readFileSync(rootIndexPath, 'utf-8');
  }
  return '<!doctype html><html><head><title>RALOA</title></head><body><div id="root"></div></body></html>';
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character] || character);
}

function escapeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function replaceHeadTag(html: string, pattern: RegExp, replacement: string): string {
  return pattern.test(html) ? html.replace(pattern, replacement) : html;
}

function setRobotsMetadata(html: string, value: string): string {
  const tag = `<meta name="robots" content="${escapeHtml(value)}" />`;
  return replaceHeadTag(html, /<meta name="robots" content=".*?" \/>/, tag);
}

function injectJsonLd(html: string, data: unknown): string {
  const script = `<script type="application/ld+json" data-ssr-seo="true">${escapeJsonLd(data)}</script>`;
  return html.replace('</head>', `${script}</head>`);
}

function canonicalOrigin(req: Request): string {
  const host = getRequestHost(req);
  const isCustomDomain = host !== 'raloa.app' && host !== 'www.raloa.app' &&
    host !== 'localhost' && host !== '127.0.0.1' && !host.endsWith('.raloa.app');
  if (isCustomDomain) return `https://${host}`;
  return 'https://raloa.app';
}

function xmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  })[character] || character);
}

const SEO_PAGES: Record<string, { title: string; description: string; heading: string; body: string }> = {
  '/': {
    title: 'RALOA - Beautiful Mini-Sites for Creators, Freelancers & Businesses',
    description: 'Create a polished mini-site for your links, content, bookings and products. Launch in minutes with RALOA - no coding required.',
    heading: 'Beautiful mini-sites for creators, freelancers, and businesses',
    body: 'RALOA gives you one place to publish your links, content, bookings, and products without coding.'
  },
  '/templates': {
    title: 'All Templates - RALOA Design Gallery',
    description: 'Explore curated mini-site templates for creators, photographers, educators, coaches, and modern businesses.',
    heading: 'Mini-site templates designed to convert',
    body: 'Choose a polished starting point, customize every section, and publish a page that feels like your brand.'
  },
  '/features': {
    title: 'Creator Toolkit & Features - RALOA',
    description: 'See RALOA tools for customizable mini-sites, links, media, publishing, analytics, and Arabic RTL support.',
    heading: 'Everything you need to publish your story',
    body: 'Build a fast, flexible mini-site with content blocks, media, links, publishing controls, and essential analytics.'
  },
  '/pricing': {
    title: 'Pricing Plans - RALOA',
    description: 'Compare RALOA Free, Pro, and Studio plans with clear monthly pricing and verified feature limits.',
    heading: 'Pricing for every creator',
    body: 'Start free, then upgrade when you need more publishing capacity, premium templates, analytics, or custom domains.'
  },
  '/guides': {
    title: 'Guides & Tutorials - RALOA',
    description: 'Learn how to create, customize, publish, and share a RALOA mini-site with practical creator guides.',
    heading: 'Practical guides for building your mini-site',
    body: 'Follow clear steps for choosing a template, adding content, publishing your page, and growing your audience.'
  },
  '/about': {
    title: 'About RALOA',
    description: 'Learn what RALOA does and how its no-code mini-site builder serves creators, freelancers, and businesses.',
    heading: 'A simpler way to share what you do',
    body: 'RALOA is a design-first mini-site builder for people who want a polished web presence without a complicated website stack.'
  },
  '/contact': {
    title: 'Contact RALOA Support & Partnerships',
    description: 'Contact RALOA for product support, partnerships, and questions about creating your mini-site.',
    heading: 'Contact the RALOA team',
    body: 'Reach out for product support, partnership questions, or help publishing your creator mini-site.'
  }
};

function injectSeoPageContent(html: string, page: typeof SEO_PAGES[string], pathName: string): string {
  const links = Object.entries(SEO_PAGES)
    .filter(([route]) => route !== pathName && route !== '/')
    .map(([route, value]) => `<a href="${route}">${escapeHtml(value.heading)}</a>`)
    .join(' · ');
  const content = `<main id="seo-prerendered-content"><h1>${escapeHtml(page.heading)}</h1><p>${escapeHtml(page.body)}</p><nav aria-label="Related RALOA pages">${links}</nav></main>`;
  return html.replace('<div id="root">', `<div id="root">${content}`);
}

const PUBLIC_LLM_GUIDE = `# RALOA

> RALOA is a web platform for creators, freelancers, and businesses to build and publish customizable mini-sites.

## Core pages

- [Homepage](https://raloa.app/): Explains how RALOA combines links, content, bookings, and products in one no-code mini-site.
- [Templates](https://raloa.app/templates): Browses the available mini-site templates and design directions for different creator types.
- [Features](https://raloa.app/features): Summarizes customization, publishing, analytics, media, and creator workflow capabilities.
- [Pricing](https://raloa.app/pricing): Compares the Free, Pro, and Studio plans, including current monthly pricing and plan limits.
- [Guides](https://raloa.app/guides): Provides practical guidance for creating, customizing, publishing, and sharing a RALOA page.
- [About RALOA](https://raloa.app/about): Describes RALOA's purpose and the creators and businesses it serves.
- [Contact](https://raloa.app/contact): Provides the support and partnership contact path for RALOA.

## Product

- [Free plan](https://raloa.app/pricing): Includes a hosted mini-site, up to 10 links, basic templates, and essential analytics.
- [Pro plan](https://raloa.app/pricing): Adds verified custom domains, premium templates, higher link and media limits, and advanced analytics.
- [Studio plan](https://raloa.app/pricing): Adds the highest publishing limits and studio-level controls for growing teams and businesses.

## Key facts

- Product type: SaaS mini-site builder.
- Primary audience: Creators, freelancers, educators, coaches, and modern businesses.
- Supported languages: English and Arabic with RTL layout support.
- Pricing currency: USD; Free is available forever, with paid monthly plans listed on the pricing page.
- Canonical website: https://raloa.app/

## Contact

- Website: https://raloa.app/
- Support: https://raloa.app/contact
`;

/**
 * 6.2 Custom Domain Mapping Contract (Database Entity)
 */
interface CustomDomainDnsRecord {
  type: 'CNAME' | 'A' | 'TXT';
  name: string;
  value: string;
  is_verified: boolean;
}

interface CustomDomainMapping {
  domain_id: string;
  site_id: string;
  user_id: string;
  hostname: string;
  ssl_status: 'pending' | 'active' | 'expired' | 'failed';
  verification_token: string;
  dns_records: CustomDomainDnsRecord[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Sample in-memory edge registry for custom domain mapping (FR-1.3)
const CUSTOM_DOMAINS: Record<string, CustomDomainMapping> = {
  'portfolio.johndoe.com': {
    domain_id: 'd-1001-uuid',
    site_id: 'elena',
    user_id: 'user-001',
    hostname: 'portfolio.johndoe.com',
    ssl_status: 'active',
    verification_token: 'raloa-verify-9a8b7c6d',
    dns_records: [
      { type: 'CNAME', name: 'portfolio', value: 'cname.raloa.app', is_verified: true },
    ],
    is_active: true,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-24T00:00:00Z',
  },
  'pending.custombrand.io': {
    domain_id: 'd-1002-uuid',
    site_id: 'studio',
    user_id: 'user-002',
    hostname: 'pending.custombrand.io',
    ssl_status: 'pending',
    verification_token: 'raloa-verify-pending-123',
    dns_records: [
      { type: 'CNAME', name: 'pending', value: 'cname.raloa.app', is_verified: false },
    ],
    is_active: false,
    created_at: '2026-09-23T00:00:00Z',
    updated_at: '2026-09-24T00:00:00Z',
  },
  'invalid.failedssl.org': {
    domain_id: 'd-1003-uuid',
    site_id: 'mateo',
    user_id: 'user-003',
    hostname: 'invalid.failedssl.org',
    ssl_status: 'failed',
    verification_token: 'raloa-verify-failed-456',
    dns_records: [
      { type: 'A', name: '@', value: '192.0.2.1', is_verified: false },
    ],
    is_active: false,
    created_at: '2026-09-22T00:00:00Z',
    updated_at: '2026-09-24T00:00:00Z',
  },
};

// Known Creator Profiles for SSR Metadata (FR-3.2)
const CREATORS_METADATA: Record<string, { name: string; avatar: string; bio: string; role: string }> = {
  elena: {
    name: 'Elena',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    bio: 'Art Director & Architectural Photographer. Exploring light, concrete and minimal spaces.',
    role: 'Art Director & Architectural Photographer',
  },
  mateo: {
    name: 'Mateo',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    bio: 'Independent director & DP crafting cinematic narratives for music and brands.',
    role: 'Filmmaker & Visual Storyteller',
  },
  studio: {
    name: 'STUDIO',
    avatar: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=400&q=80',
    bio: 'Sustainable interior architecture, bespoke ceramics and calm living spaces.',
    role: 'Modern Interior & Object Design',
  },
  'dr-ahmed': {
    name: 'Dr. Ahmed',
    avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=400&q=80',
    bio: 'Consultant Dermatologist & Skincare Educator. Evidence-based routines.',
    role: 'Consultant Dermatologist',
  },
  forma: {
    name: 'Forma Design',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    bio: 'Digital product design agency building clean interfaces.',
    role: 'Design Agency',
  },
};

/**
 * Cookie parsing utility
 */
export function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts.shift()?.trim();
    if (name) {
      list[name] = decodeURIComponent(parts.join('=').trim());
    }
  });
  return list;
}

/**
 * Password hashing utility (SEC-1 Argon2id / scrypt memory-hard equivalent)
 */
export function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export interface UserAccount {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  primary_handle: string;
  email_verified: boolean;
  referralsCount?: number;
  referredBy?: string;
  referralRewards?: {
    verifiedBadgeUnlocked: boolean;
    freeProMonthsEarned: number;
    customDomainUnlocked: boolean;
  };
  referralProUntil?: string;
}

export const DEFAULT_SALT = 'raloa_salt_secure_2026';

// The local account is test/development infrastructure only. Production auth
// is provided by the configured identity provider and starts with no seeded users.
export const USERS_DB: Record<string, UserAccount> = {};
if (localAuthEnabled) {
  USERS_DB['creator@example.com'] = {
    id: 'usr_9bf7cf1a80c',
    email: 'creator@example.com',
    passwordHash: hashPassword('SecurePassword123!', DEFAULT_SALT),
    salt: DEFAULT_SALT,
    primary_handle: 'creator',
    email_verified: true,
  };
}

const USERS_CACHE_FILE = path.join(__dirname, '.local_users_cache.json');
if (localAuthEnabled) {
  try {
    if (fs.existsSync(USERS_CACHE_FILE)) {
      const raw = fs.readFileSync(USERS_CACHE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      Object.assign(USERS_DB, parsed);
    }
  } catch (_) {
    // Local cache is optional test/development state.
  }
}

// Do not seed or recreate accounts when local auth is disabled.

export function persistUsersCache() {
  if (!localAuthEnabled) return;
  try {
    fs.writeFileSync(USERS_CACHE_FILE, JSON.stringify(USERS_DB, null, 2));
  } catch (_) {}
}

// Reserved handles that cannot be claimed (FR-2.1)
export const RESERVED_HANDLES = new Set([
  'admin', 'support', 'help', 'api', 'raloa', 'team', 'official',
  'billing', 'root', 'security', 'studio', 'login', 'register',
  'features', 'pricing', 'guides', 'about', 'contact', 'legal'
]);
for (const slug of RESERVED_SITE_SLUGS) RESERVED_HANDLES.add(slug);

export interface ActiveSession {
  userId: string;
  email: string;
  primary_handle: string;
  createdAt: number;
  expiresAt: number;
}

// Active session store (FR-4.1)
export const ACTIVE_SESSIONS = new Map<string, ActiveSession>();

function qualifyLocalReferral(newUser: UserAccount, referralCode?: string): void {
  const cleanCode = referralCode?.trim().toLowerCase();
  if (!cleanCode) return;

  const referrer = Object.values(USERS_DB).find(
    (candidate) => candidate.primary_handle.toLowerCase() === cleanCode && candidate.id !== newUser.id
  );
  if (!referrer) return;

  const currentCount = referrer.referralsCount || 0;
  const nextCount = currentCount + 1;
  const earnedBefore = Math.floor(currentCount / 3);
  const earnedAfter = Math.floor(nextCount / 3);
  const newFreeMonths = earnedAfter - earnedBefore;
  const currentProUntil = referrer.referralProUntil ? Date.parse(referrer.referralProUntil) : 0;
  const baseDate = Math.max(Date.now(), Number.isFinite(currentProUntil) ? currentProUntil : 0);

  referrer.referralsCount = nextCount;
  referrer.referralRewards = {
    verifiedBadgeUnlocked: nextCount >= 1,
    freeProMonthsEarned: earnedAfter,
    customDomainUnlocked: nextCount >= 5
  };
  if (newFreeMonths > 0) {
    referrer.referralProUntil = new Date(baseDate + newFreeMonths * 30 * 24 * 60 * 60 * 1000).toISOString();
  }
  newUser.referredBy = referrer.id;
}

// Failed login tracker for SEC-2 Brute Force Throttling
// Key: `${ip}:${email.toLowerCase()}`
export const LOGIN_ATTEMPTS = new Map<string, { count: number; lockedUntil: number; firstAttemptAt: number }>();

// Contact submission IP rate limit (FR-2.4: max 5 per hour per IP)
export const CONTACT_RATE_LIMITS = new Map<string, number[]>();
export const CONTACT_SUBMISSIONS: Array<{
  id: string;
  fullName: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
}> = [];

async function getAuthenticatedUser(req: Request): Promise<AuthenticatedUser | null> {
  const authorization = req.headers.authorization;
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    const user = await verifyBearerToken(authorization.slice(7));
    if (user) return user;
  }

  const sessionToken = parseCookies(req.headers.cookie).raloa_session;
  if (process.env.NODE_ENV === 'production' && sessionToken) {
    return await verifySignedSessionCookie(sessionToken);
  }
  const session = sessionToken ? ACTIVE_SESSIONS.get(sessionToken) : undefined;
  return session && session.expiresAt > Date.now()
    ? { uid: session.userId, email: session.email }
    : null;
}

type OwnedSite = {
  id: string;
  userId: string;
  data: Record<string, any>;
  snapshot: DocumentSnapshot;
};

/** Resolve site ownership from the authenticated UID, never from client claims. */
async function getOwnedSite(userId: string, siteId: string): Promise<OwnedSite | null> {
  const normalizedSiteId = String(siteId || '').trim();
  if (!userId || !/^[a-zA-Z0-9_-]{1,64}$/.test(normalizedSiteId)) return null;
  const snapshot = await adminDb.collection('users').doc(userId).collection('sites').doc(normalizedSiteId).get();
  if (!snapshot.exists) return null;
  return { id: snapshot.id, userId, data: snapshot.data() || {}, snapshot };
}

type OAuthProvider = 'github';
type StoredIntegration = {
  provider: OAuthProvider;
  userId: string;
  providerAccountId: string;
  accountLabel: string;
  profileUrl: string;
  scopes: string[];
  status: 'connected' | 'reauthorization_required' | 'error';
  encryptedAccessToken: string;
  tokenExpiresAt: string | null;
  connectedAt: string;
  updatedAt: string;
  lastError?: string;
};

const OAUTH_SCOPES: Record<OAuthProvider, string[]> = { github: ['read:user'] };
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function integrationEncryptionKey(): Buffer {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY || (process.env.NODE_ENV !== 'production' ? AUTH_SESSION_SECRET : '');
  if (!secret || secret.length < 32) throw new Error('INTEGRATION_ENCRYPTION_KEY_NOT_CONFIGURED');
  return crypto.createHash('sha256').update(secret).digest();
}

function integrationEncryptionConfigured(): boolean {
  return AUTH_SESSION_SECRET.length >= 32 && Boolean((process.env.INTEGRATION_ENCRYPTION_KEY && process.env.INTEGRATION_ENCRYPTION_KEY.length >= 32) || (process.env.NODE_ENV !== 'production' && AUTH_SESSION_SECRET.length >= 32));
}

function encryptIntegrationToken(token: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', integrationEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}

function decryptIntegrationToken(value: string): string {
  const [ivValue, tagValue, ciphertextValue] = value.split('.');
  if (!ivValue || !tagValue || !ciphertextValue) throw new Error('INVALID_ENCRYPTED_INTEGRATION_TOKEN');
  const decipher = crypto.createDecipheriv('aes-256-gcm', integrationEncryptionKey(), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, 'base64url')), decipher.final()]).toString('utf8');
}

function githubConfig(): { clientId: string; clientSecret: string; redirectUri: string } | null {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const redirectUri = process.env.GITHUB_OAUTH_REDIRECT_URI || `${APP_URL}/api/integrations/github/callback`;
  return clientId && clientSecret ? { clientId, clientSecret, redirectUri } : null;
}

function signOAuthState(payload: string): string {
  if (AUTH_SESSION_SECRET.length < 32) throw new Error('AUTH_SESSION_SECRET_NOT_CONFIGURED');
  return crypto.createHmac('sha256', AUTH_SESSION_SECRET).update(payload).digest('base64url');
}

function publicIntegration(data: StoredIntegration): Record<string, unknown> {
  return {
    provider: data.provider,
    status: data.status,
    accountId: data.providerAccountId,
    accountLabel: data.accountLabel,
    profileUrl: data.profileUrl,
    scopes: data.scopes,
    connectedAt: data.connectedAt,
    updatedAt: data.updatedAt,
    ...(data.lastError ? { lastError: data.lastError } : {})
  };
}

async function githubApi(pathname: string, init: RequestInit = {}): Promise<any> {
  const response = await fetch(`https://api.github.com${pathname}`, {
    ...init,
    signal: init.signal || AbortSignal.timeout(10000),
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'raloa-social-integrations',
      ...(init.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `GitHub request failed with ${response.status}`);
  return body;
}

type SocialIntegrationAdapter = {
  provider: OAuthProvider;
  scopes: string[];
  authorizeUrl(config: { clientId: string; redirectUri: string }, state: string): string;
  exchangeCode(config: { clientId: string; clientSecret: string; redirectUri: string }, code: string): Promise<{ accessToken: string }>;
  getProfile(accessToken: string): Promise<{ id: string; label: string; profileUrl: string }>;
  validateToken(accessToken: string): Promise<void>;
  revokeToken(config: { clientId: string; clientSecret: string }, accessToken: string): Promise<void>;
};

const socialAdapters: Record<OAuthProvider, SocialIntegrationAdapter> = {
  github: {
    provider: 'github',
    scopes: OAUTH_SCOPES.github,
    authorizeUrl(config, state) {
      const url = new URL('https://github.com/login/oauth/authorize');
      url.searchParams.set('client_id', config.clientId);
      url.searchParams.set('redirect_uri', config.redirectUri);
      url.searchParams.set('scope', OAUTH_SCOPES.github.join(' '));
      url.searchParams.set('state', state);
      return url.toString();
    },
    async exchangeCode(config, code) {
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST', signal: AbortSignal.timeout(10000),
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'raloa-social-integrations' },
        body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, code, redirect_uri: config.redirectUri })
      });
      const body = await response.json() as { access_token?: string; error?: string };
      if (!response.ok || !body.access_token) throw new Error(body.error || 'GitHub token exchange failed');
      return { accessToken: body.access_token };
    },
    async getProfile(accessToken) {
      const account = await githubApi('/user', { headers: { Authorization: `Bearer ${accessToken}` } });
      return { id: String(account.id), label: String(account.login || account.name || 'GitHub'), profileUrl: String(account.html_url) };
    },
    async validateToken(accessToken) { await githubApi('/user', { headers: { Authorization: `Bearer ${accessToken}` } }); },
    async revokeToken(config, accessToken) {
      const response = await fetch(`https://api.github.com/applications/${encodeURIComponent(config.clientId)}/token`, { method: 'DELETE', signal: AbortSignal.timeout(10000), headers: { Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`, Accept: 'application/vnd.github+json', 'User-Agent': 'raloa-social-integrations', 'Content-Type': 'application/json' }, body: JSON.stringify({ access_token: accessToken }) });
      if (!response.ok && response.status !== 404) throw new Error(`GitHub token revoke failed with ${response.status}`);
    }
  }
};

function normalizeHostname(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const hostname = value.trim().toLowerCase().replace(/\.$/, '');
  if (!/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(hostname)) return null;
  if (hostname === 'raloa.app' || hostname.endsWith('.raloa.app')) return null;
  return hostname;
}

function validEmail(value: string): boolean {
  return value.length <= 320 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

type AnalyticsDimensions = {
  eventId: string;
  visitorIdHash: string;
  referrerHost: string | null;
  country: string | null;
  device: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  browser: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
};

function boundedAnalyticsValue(value: unknown, maxLength = 120): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function analyticsBrowser(userAgent: string): string {
  if (/Edg\//i.test(userAgent)) return 'Edge';
  if (/OPR\//i.test(userAgent)) return 'Opera';
  if (/SamsungBrowser/i.test(userAgent)) return 'Samsung Internet';
  if (/Firefox\//i.test(userAgent)) return 'Firefox';
  if (/CriOS\//i.test(userAgent) || /Chrome\//i.test(userAgent)) return 'Chrome';
  if (/Safari\//i.test(userAgent) && !/Chrome|CriOS/i.test(userAgent)) return 'Safari';
  if (/MSIE|Trident\//i.test(userAgent)) return 'Internet Explorer';
  return userAgent ? 'Other' : 'Unknown';
}

function analyticsDevice(userAgent: string): AnalyticsDimensions['device'] {
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent)) return 'tablet';
  if (/Mobile|iPhone|Android/i.test(userAgent)) return 'mobile';
  return userAgent ? 'desktop' : 'unknown';
}

function analyticsReferrerHost(value: unknown): string | null {
  const raw = boundedAnalyticsValue(value, 200);
  if (!raw) return null;
  try { return new URL(raw.includes('://') ? raw : `https://${raw}`).hostname.toLowerCase().slice(0, 120); } catch { return null; }
}

function analyticsDimensions(req: Request, body: Record<string, unknown>): AnalyticsDimensions {
  const userAgent = String(req.headers['user-agent'] || body.userAgent || '').slice(0, 512);
  const visitorId = boundedAnalyticsValue(body.visitorId, 200) || `${req.ip || 'unknown'}:${userAgent}`;
  const salt = process.env.ANALYTICS_HASH_SALT || AUTH_SESSION_SECRET || 'raloa-analytics-development-salt';
  const eventId = boundedAnalyticsValue(body.eventId, 128) || crypto.randomUUID();
  return {
    eventId,
    visitorIdHash: crypto.createHash('sha256').update(`${salt}:${visitorId}`).digest('hex'),
    referrerHost: analyticsReferrerHost(body.referrer || req.headers.referer),
    country: boundedAnalyticsValue(req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || body.country, 2)?.toUpperCase() || null,
    device: analyticsDevice(userAgent),
    browser: analyticsBrowser(userAgent),
    utmSource: boundedAnalyticsValue(body.utm_source),
    utmMedium: boundedAnalyticsValue(body.utm_medium),
    utmCampaign: boundedAnalyticsValue(body.utm_campaign),
    utmTerm: boundedAnalyticsValue(body.utm_term),
    utmContent: boundedAnalyticsValue(body.utm_content)
  };
}

async function persistAnalyticsRollup(collection: 'page_views' | 'link_clicks', siteOwnerId: string, siteId: string, dimensions: AnalyticsDimensions, data: Record<string, unknown>): Promise<void> {
  if (!siteId) return;
  const timestamp = String(data.timestamp || new Date().toISOString());
  const day = timestamp.slice(0, 10);
  const base = { siteOwnerId, siteId, date: day, updatedAt: new Date().toISOString() };
  const batch = adminDb.batch();
  const rollups = adminDb.collection('analytics_rollups');
  const summaryRef = rollups.doc(crypto.createHash('sha256').update(`${siteOwnerId}:${siteId}:${day}:summary`).digest('hex'));
  batch.set(summaryRef, { ...base, kind: 'summary', pageViews: collection === 'page_views' ? FieldValue.increment(1) : FieldValue.increment(0), linkClicks: collection === 'link_clicks' ? FieldValue.increment(1) : FieldValue.increment(0) }, { merge: true });
  const incrementDimension = (dimension: string, key: string | null) => {
    if (!key) return;
    const ref = rollups.doc(crypto.createHash('sha256').update(`${siteOwnerId}:${siteId}:${day}:dimension:${dimension}:${key}`).digest('hex'));
    batch.set(ref, { ...base, kind: 'dimension', dimension, key, [collection === 'page_views' ? 'views' : 'clicks']: FieldValue.increment(1) }, { merge: true });
  };
  incrementDimension('referrer', dimensions.referrerHost || '(direct)');
  incrementDimension('device', dimensions.device);
  incrementDimension('browser', dimensions.browser);
  incrementDimension('country', dimensions.country || '(unknown)');
  const source = dimensions.utmSource || '(direct)';
  const medium = dimensions.utmMedium || '(none)';
  const campaign = dimensions.utmCampaign || '(none)';
  const utmKey = `${source}\u0000${medium}\u0000${campaign}`;
  const utmRef = rollups.doc(crypto.createHash('sha256').update(`${siteOwnerId}:${siteId}:${day}:utm:${utmKey}`).digest('hex'));
  batch.set(utmRef, { ...base, kind: 'utm', source, medium, campaign, [collection === 'page_views' ? 'views' : 'clicks']: FieldValue.increment(1) }, { merge: true });
  if (collection === 'link_clicks') {
    const linkId = String(data.linkId || 'unknown');
    const linkRef = rollups.doc(crypto.createHash('sha256').update(`${siteOwnerId}:${siteId}:${day}:link:${linkId}`).digest('hex'));
    batch.set(linkRef, { ...base, kind: 'link', linkId, clicks: FieldValue.increment(1) }, { merge: true });
  } else {
    const visitorRef = adminDb.collection('analytics_visitor_days').doc(crypto.createHash('sha256').update(`${siteOwnerId}:${siteId}:${day}:${dimensions.visitorIdHash}`).digest('hex'));
    batch.set(visitorRef, { siteOwnerId, siteId, date: day, visitorIdHash: dimensions.visitorIdHash, createdAt: timestamp }, { merge: true });
  }
  await batch.commit();
}

async function persistAnalyticsEvent(collection: 'page_views' | 'link_clicks', siteOwnerId: string, siteHandle: string, dimensions: AnalyticsDimensions, extra: Record<string, unknown>): Promise<boolean> {
  const eventKey = analyticsEventDocumentId(collection, siteOwnerId, dimensions.eventId);
  const reference = adminDb.collection(collection).doc(eventKey);
  try {
    const timestamp = new Date().toISOString();
    await reference.create({
      eventId: dimensions.eventId,
      siteOwnerId,
      siteHandle,
      visitorIdHash: dimensions.visitorIdHash,
      referrerHost: dimensions.referrerHost,
      country: dimensions.country,
      device: dimensions.device,
      browser: dimensions.browser,
      utmSource: dimensions.utmSource,
      utmMedium: dimensions.utmMedium,
      utmCampaign: dimensions.utmCampaign,
      utmTerm: dimensions.utmTerm,
      utmContent: dimensions.utmContent,
      timestamp,
      ...extra
    });
    try {
      await persistAnalyticsRollup(collection, siteOwnerId, String(extra.siteId || ''), dimensions, { ...extra, timestamp });
    } catch (rollupError) {
      // The canonical event is already persisted. Keep ingestion successful and
      // let the paginated legacy reader/backfill recover the aggregate later.
      console.error('[Analytics rollup]', rollupError);
    }
    return true;
  } catch (error: any) {
    if (error?.code === 6 || error?.code === 'already-exists') return false;
    throw error;
  }
}

export function analyticsEventDocumentId(collection: 'page_views' | 'link_clicks', siteOwnerId: string, eventId: string): string {
  return crypto.createHash('sha256').update(`${collection}:${siteOwnerId}:${eventId}`).digest('hex');
}

const PRODUCT_CURRENCIES = new Set(['usd', 'eur', 'gbp', 'sar', 'aed', 'cad', 'aud']);

function publicProduct(data: Record<string, unknown>): Record<string, unknown> {
  const normalized = normalizeProductInput(data);
  return {
    id: data.id,
    name: normalized.name,
    description: normalized.description,
    imageUrls: normalized.imageUrls,
    priceMinor: normalized.priceMinor,
    currency: normalized.currency,
    active: normalized.active,
    inventory: normalized.inventory === null ? null : Math.max(0, Number(normalized.inventory)),
    availableQuantity: data.inventory === null || data.inventory === undefined
      ? null
      : Math.max(0, Number(data.inventory) - Number(data.inventoryReserved || 0))
  };
}

async function creatorProducts(userId: string, siteId?: string, limit = 100, cursor?: { createdAt: string; id: string } | null) {
  let query: Query = adminDb.collection('creator_products').where('creatorId', '==', userId);
  if (siteId) query = query.where('siteId', '==', siteId);
  query = query.orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc').limit(limit + 1);
  if (cursor) query = query.startAfter(cursor.createdAt, cursor.id);
  const snapshot = await query.get();
  const raw = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
  const last = snapshot.docs[limit];
  return { products: raw.slice(0, limit), hasMore: snapshot.docs.length > limit, nextCursor: snapshot.docs.length > limit && last ? encodePageCursor({ createdAt: String(last.data()?.createdAt || ''), id: last.id }) : null };
}

function isSafePublicUrl(value: unknown, allowAnchor = false): value is string {
  if (typeof value !== 'string' || value.length > 2000) return false;
  if (allowAnchor && value.startsWith('#')) return /^#[a-zA-Z0-9_-]{1,80}$/.test(value);
  if (/^(javascript|data|vbscript):/i.test(value) || value.startsWith('//')) return false;
  try {
    const parsed = new URL(value);
    return ['https:', 'http:', 'mailto:', 'tel:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function dateInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
  return Date.UTC(values.year, values.month - 1, values.day, values.hour === 24 ? 0 : values.hour, values.minute, values.second) - date.getTime();
}

function zonedDateTimeToUtc(date: string, time: string, timeZone: string): Date {
  const guess = new Date(`${date}T${time}:00.000Z`);
  const first = new Date(guess.getTime() - timeZoneOffsetMs(guess, timeZone));
  return new Date(guess.getTime() - timeZoneOffsetMs(first, timeZone));
}

function minutesFromTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

async function bookingRecordsForHost(hostUserId: string, siteId?: string, fromMs?: number, toMs?: number): Promise<Array<Record<string, unknown>>> {
  if (!isAdminConfigured()) return [];
  let query: Query = adminDb.collection('bookings').where('hostUserId', '==', hostUserId);
  if (siteId) query = query.where('siteId', '==', siteId);
  if (Number.isFinite(toMs)) query = query.where('slotStartMs', '<', Number(toMs));
  const snapshot = await query.get();
  return snapshot.docs.map((document) => document.data()).filter((booking) => {
    if (siteId && String(booking.siteId || '') !== siteId) return false;
    if (Number.isFinite(fromMs) && Number(booking.slotEndMs || 0) <= Number(fromMs)) return false;
    if (Number.isFinite(toMs) && Number(booking.slotStartMs || 0) >= Number(toMs)) return false;
    return true;
  });
}

async function bookingDeliveryStatus(bookingId: string): Promise<Record<string, unknown>> {
  const [notifications, calendars] = await Promise.all([
    adminDb.collection('notification_jobs').where('bookingId', '==', bookingId).limit(20).get(),
    adminDb.collection('calendar_jobs').where('bookingId', '==', bookingId).limit(10).get()
  ]);
  const notificationStatuses = notifications.docs.map((document) => String(document.data()?.status || 'unknown'));
  const calendarStatuses = calendars.docs.map((document) => String(document.data()?.status || 'unknown'));
  const failed = [...notificationStatuses, ...calendarStatuses].some((status) => ['failed', 'blocked'].includes(status));
  const retrying = [...notificationStatuses, ...calendarStatuses].some((status) => ['pending', 'retry', 'processing', 'awaiting_confirmation'].includes(status));
  return {
    notifications: notificationStatuses,
    calendar: calendarStatuses,
    state: failed ? 'failed' : retrying ? 'pending' : notificationStatuses.length === 0 ? 'unknown' : 'delivered',
    failed
  };
}

function availableSlots(config: BookingConfig, service: BookingServiceConfig, fromDate: string, toDate: string, existing: Array<Record<string, unknown>>): Array<{ start: string; end: string; localDate: string; localTime: string; serviceId: string }> {
  const from = new Date(`${fromDate}T00:00:00.000Z`);
  const to = new Date(`${toDate}T00:00:00.000Z`);
  const now = Date.now();
  const slots: Array<{ start: string; end: string; localDate: string; localTime: string; serviceId: string }> = [];
  for (let cursor = from.getTime(); cursor <= to.getTime(); cursor += 86400000) {
    const localDate = new Date(cursor).toISOString().slice(0, 10);
    if (config.blackoutDates.includes(localDate)) continue;
    const day = new Date(`${localDate}T12:00:00.000Z`).getUTCDay();
    const window = config.weeklyAvailability[String(day)];
    if (!window?.enabled) continue;
    const startMinute = minutesFromTime(window.start);
    const endMinute = minutesFromTime(window.end);
    const step = Math.max(15, service.durationMinutes + (service.bufferMinutes || 0) + config.bufferMinutes);
    for (let minute = startMinute; minute + service.durationMinutes <= endMinute; minute += step) {
      const localTime = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
      const start = zonedDateTimeToUtc(localDate, localTime, config.timezone);
      const end = new Date(start.getTime() + service.durationMinutes * 60000);
      if (start.getTime() < now + config.minNoticeMinutes * 60000) continue;
      if (start.getTime() > now + config.bookingWindowDays * 86400000) continue;
      const overlaps = existing.some((booking) => booking.status !== 'cancelled' && Number(booking.slotStartMs) < end.getTime() && Number(booking.slotEndMs) > start.getTime());
      const dailyCount = existing.filter((booking) => booking.status !== 'cancelled' && booking.localDate === localDate).length;
      if (!overlaps && dailyCount < config.maxBookingsPerDay) {
        slots.push({ start: start.toISOString(), end: end.toISOString(), localDate, localTime, serviceId: service.id });
      }
    }
  }
  return slots;
}

function escapeEmailText(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character));
}

async function processPendingBookingNotifications(): Promise<void> {
  if (!isAdminConfigured() || !process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return;
  const jobs = await adminDb.collection('notification_jobs').where('status', 'in', ['pending', 'retry', 'processing']).limit(50).get();
  for (const jobSnapshot of jobs.docs) {
    const job = jobSnapshot.data();
    if (job.nextAttemptAt && Date.parse(String(job.nextAttemptAt)) > Date.now()) continue;
    if (job.status === 'processing' && Date.parse(String(job.updatedAt || 0)) > Date.now() - 10 * 60 * 1000) continue;
    const bookingSnapshot = await adminDb.collection('bookings').doc(String(job.bookingId || '')).get();
    if (!bookingSnapshot.exists) {
      await jobSnapshot.ref.update({ status: 'failed', lastError: 'BOOKING_NOT_FOUND', updatedAt: new Date().toISOString() });
      continue;
    }
    const booking = bookingSnapshot.data() || {};
    const claim = await adminDb.runTransaction(async (transaction) => {
      const current = await transaction.get(jobSnapshot.ref);
      const currentStatus = String(current.data()?.status || '');
      const currentUpdatedAt = Date.parse(String(current.data()?.updatedAt || 0));
      if (!current.exists || !['pending', 'retry'].includes(currentStatus) && !(currentStatus === 'processing' && currentUpdatedAt <= Date.now() - 10 * 60 * 1000)) return false;
      transaction.update(jobSnapshot.ref, { status: 'processing', attempts: Number(current.data()?.attempts || 0) + 1, updatedAt: new Date().toISOString() });
      return true;
    });
    if (!claim) continue;
    const recipient = typeof job.email === 'string' ? job.email : '';
    const subject = job.type === 'booking_request' ? 'New booking request received' : job.type === 'booking_confirmed' ? 'Booking confirmed' : 'Booking request received';
    const html = `<p>${subject}</p><p>Service: ${escapeEmailText(String(booking.serviceName || 'Appointment'))}</p><p>When: ${escapeEmailText(String(booking.localDate || ''))} ${escapeEmailText(String(booking.localTime || ''))} (${escapeEmailText(String(booking.timezone || 'UTC'))})</p>`;
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `notification:${jobSnapshot.id}` },
        body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to: [recipient], subject, html })
      });
      if (!response.ok) throw new Error(`RESEND_${response.status}`);
      await jobSnapshot.ref.update({ status: 'sent', sentAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    } catch (error) {
      const attempts = Number(jobSnapshot.data()?.attempts || 1);
      const terminal = attempts >= 8;
      const delayMs = Math.min(6 * 60 * 60 * 1000, 30_000 * (2 ** Math.min(attempts - 1, 8))) + Math.floor(Math.random() * 10_000);
      await jobSnapshot.ref.update({ status: terminal ? 'failed' : 'retry', lastError: error instanceof Error ? error.message : 'DELIVERY_FAILED', nextAttemptAt: terminal ? null : new Date(Date.now() + delayMs).toISOString(), updatedAt: new Date().toISOString() });
    }
  }
}

async function processPendingCalendarJobs(): Promise<void> {
  if (!isAdminConfigured()) return;
  const jobs = await adminDb.collection('calendar_jobs').where('status', 'in', ['pending', 'retry', 'processing']).limit(50).get();
  for (const jobSnapshot of jobs.docs) {
    const job = jobSnapshot.data();
    if (job.nextAttemptAt && Date.parse(String(job.nextAttemptAt)) > Date.now()) continue;
    if (job.status === 'processing' && Date.parse(String(job.updatedAt || 0)) > Date.now() - 10 * 60 * 1000) continue;
    const claimed = await adminDb.runTransaction(async (transaction) => {
      const current = await transaction.get(jobSnapshot.ref);
      const currentStatus = String(current.data()?.status || '');
      const currentUpdatedAt = Date.parse(String(current.data()?.updatedAt || 0));
      if (!current.exists || !['pending', 'retry'].includes(currentStatus) && !(currentStatus === 'processing' && currentUpdatedAt <= Date.now() - 10 * 60 * 1000)) return false;
      transaction.update(jobSnapshot.ref, { status: 'processing', attempts: Number(current.data()?.attempts || 0) + 1, updatedAt: new Date().toISOString() });
      return true;
    });
    if (!claimed) continue;
    try {
      const bookingSnapshot = await adminDb.collection('bookings').doc(String(job.bookingId || '')).get();
      if (!bookingSnapshot.exists) throw new Error('BOOKING_NOT_FOUND');
      if (bookingSnapshot.data()?.status === 'cancelled' && job.operation !== 'cancel') throw new Error('BOOKING_NOT_ACTIVE');
      const booking = bookingSnapshot.data() || {};
      const provider = String(job.provider || '') as CalendarProvider;
      if (!['google', 'outlook'].includes(provider)) throw new Error('CALENDAR_PROVIDER_NOT_CONFIGURED');
      const integrationRef = adminDb.collection('calendar_integrations').doc(`${String(booking.hostUserId)}_${provider}`);
      const integrationSnapshot = await integrationRef.get();
      if (!integrationSnapshot.exists) throw new Error('CALENDAR_REAUTH_REQUIRED');
      const integration = integrationSnapshot.data() || {};
      const adapter = calendarAdapter(provider);
      let tokens = decryptCalendarTokens(String(integration.encryptedTokens || ''));
      const refreshed = await adapter.refresh(tokens);
      if (JSON.stringify(refreshed) !== JSON.stringify(tokens)) {
        tokens = refreshed;
        await integrationRef.set({ encryptedTokens: encryptCalendarTokens(tokens), expiresAt: tokens.expiresAt, updatedAt: new Date().toISOString() }, { merge: true });
      }
      if (job.operation === 'cancel') {
        if (typeof job.externalEventId === 'string' && job.externalEventId) await adapter.cancelEvent(tokens, job.externalEventId);
        await jobSnapshot.ref.update({ status: 'completed', completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      } else {
        const event: CalendarBookingEvent = { id: String(booking.id), title: `${String(booking.serviceName || 'Appointment')} with ${String(booking.customerName || 'Guest')}`, description: String(booking.notes || ''), start: String(booking.slotStart), end: String(booking.slotEnd), timezone: String(booking.timezone || 'UTC'), attendeeEmail: String(booking.customerEmail) };
        const created = await adapter.createEvent(tokens, event);
        await jobSnapshot.ref.update({ status: 'completed', externalEventId: created.externalEventId, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      }
    } catch (error) {
      const attempts = Number(jobSnapshot.data()?.attempts || 1);
      const message = error instanceof Error ? error.message : 'CALENDAR_DELIVERY_FAILED';
      const requiresAuth = message === 'CALENDAR_REAUTH_REQUIRED' || message.includes('401') || message.includes('403');
      const terminal = requiresAuth || attempts >= 8;
      const delayMs = Math.min(6 * 60 * 60 * 1000, 30_000 * (2 ** Math.min(attempts - 1, 8))) + Math.floor(Math.random() * 10_000);
      await jobSnapshot.ref.update({ status: terminal ? 'blocked' : 'retry', lastError: message, nextAttemptAt: terminal ? null : new Date(Date.now() + delayMs).toISOString(), updatedAt: new Date().toISOString() });
    }
  }
}

function hasPaidPlan(profile: DocumentData | undefined): boolean {
  return getPlanTier(profile as any) !== 'free';
}

function entitlementError(res: Response, feature: string, message: string, details?: Record<string, string>) {
  return apiError(res, 403, 'ENTITLEMENT_REQUIRED', message, { feature, ...details });
}

function siteMediaCount(site: Record<string, any>): number {
  const urls = new Set<string>();
  for (const value of [site.avatar, site.coverImage]) if (typeof value === 'string' && value.trim()) urls.add(value.trim());
  if (Array.isArray(site.links)) for (const link of site.links) {
    if (typeof link?.thumbnail === 'string' && link.thumbnail.trim()) urls.add(link.thumbnail.trim());
    if (Array.isArray(link?.galleryItems)) for (const item of link.galleryItems) {
      if (typeof item?.src === 'string' && item.src.trim()) urls.add(item.src.trim());
      if (typeof item?.thumbnail === 'string' && item.thumbnail.trim()) urls.add(item.thumbnail.trim());
    }
  }
  return urls.size;
}

const MEDIA_PURPOSES = new Set(['gallery', 'product', 'background', 'block', 'avatar']);
const MEDIA_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_MEDIA_DIMENSION = 8192;
const MEDIA_SIGNED_URL_TTL_MS = 15 * 60 * 1000;
const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => callback(null, MEDIA_MIME_TYPES.has(file.mimetype))
});

function parseMediaUpload(req: Request, res: Response, next: NextFunction): void {
  mediaUpload.single('file')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      apiError(res, 413, 'MEDIA_TOO_LARGE', 'The uploaded file is larger than the maximum allowed size.');
      return;
    }
    apiError(res, 400, 'INVALID_MEDIA_FILE', 'Upload a JPEG, PNG, or WebP image.');
  });
}

async function authenticateMediaUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
    return;
  }
  (req as Request & { mediaUser?: AuthenticatedUser }).mediaUser = user;
  next();
}

function mediaPublicUrl(mediaId: string): string {
  return `${APP_URL}/api/media/public/${encodeURIComponent(mediaId)}`;
}

function mediaThumbnailUrl(mediaId: string): string {
  return `${APP_URL}/api/media/public/${encodeURIComponent(mediaId)}?variant=thumbnail`;
}

function mediaIdFromUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = new URL(value);
    const match = parsed.pathname.match(/\/api\/media\/public\/([^/]+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function collectMediaIds(site: Record<string, any>): string[] {
  const ids = new Set<string>();
  for (const value of [site.avatar, site.coverImage]) {
    const id = mediaIdFromUrl(value);
    if (id) ids.add(id);
  }
  if (Array.isArray(site.links)) for (const link of site.links) {
    for (const value of [link?.thumbnail, link?.url]) {
      const id = mediaIdFromUrl(value);
      if (id) ids.add(id);
    }
    if (Array.isArray(link?.galleryItems)) for (const item of link.galleryItems) {
      for (const value of [item?.src, item?.thumbnail]) {
        const id = mediaIdFromUrl(value);
        if (id) ids.add(id);
      }
    }
  }
  if (Array.isArray(site.imageUrls)) for (const value of site.imageUrls) {
    const id = mediaIdFromUrl(value);
    if (id) ids.add(id);
  }
  return [...ids];
}

async function validateOwnedMediaReferences(site: Record<string, any>, userId: string, siteId: string): Promise<string | null> {
  const ids = collectMediaIds(site);
  if (ids.length === 0) return null;
  const snapshots: DocumentSnapshot[] = [];
  for (let index = 0; index < ids.length; index += 100) {
    snapshots.push(...await Promise.all(ids.slice(index, index + 100).map((id) => adminDb.collection('media_assets').doc(id).get())));
  }
  if (snapshots.some((snapshot) => !snapshot.exists || snapshot.data()?.userId !== userId || snapshot.data()?.siteId !== siteId || snapshot.data()?.status !== 'ready')) {
    return 'One or more media assets are not owned by this site or are not ready.';
  }
  return null;
}

function countExternalMedia(site: Record<string, any>): number {
  const values: string[] = [];
  for (const value of [site.avatar, site.coverImage]) if (typeof value === 'string' && value.trim()) values.push(value.trim());
  if (Array.isArray(site.links)) for (const link of site.links) {
    if (typeof link?.thumbnail === 'string' && link.thumbnail.trim()) values.push(link.thumbnail.trim());
    if (Array.isArray(link?.galleryItems)) for (const item of link.galleryItems) {
      if (typeof item?.src === 'string' && item.src.trim()) values.push(item.src.trim());
      if (typeof item?.thumbnail === 'string' && item.thumbnail.trim()) values.push(item.thumbnail.trim());
    }
  }
  return new Set(values.filter((value) => !mediaIdFromUrl(value))).size;
}

async function deleteMediaAsset(document: DocumentSnapshot): Promise<void> {
  const data = document.data() || {};
  for (const pathValue of [data.originalPath, data.thumbnailPath]) {
    if (typeof pathValue === 'string' && pathValue) await adminStorage.file(pathValue).delete({ ignoreNotFound: true });
  }
  await document.ref.delete();
}

async function cleanupOrphanMedia(userId: string, siteId: string): Promise<number> {
  const siteSnapshot = await adminDb.collection('users').doc(userId).collection('sites').doc(siteId).get();
  if (!siteSnapshot.exists) return 0;
  const referenced = new Set(collectMediaIds(siteSnapshot.data() || {}));
  const products = await adminDb.collection('creator_products').where('creatorId', '==', userId).where('siteId', '==', siteId).limit(500).get();
  products.docs.forEach((product) => collectMediaIds({ imageUrls: product.data()?.imageUrls }).forEach((id) => referenced.add(id)));
  const assets = await adminDb.collection('media_assets').where('userId', '==', userId).where('siteId', '==', siteId).limit(500).get();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const document of assets.docs) {
    const data = document.data();
    const createdAt = Date.parse(String(data.createdAt || ''));
    if (!referenced.has(document.id) && (!Number.isFinite(createdAt) || createdAt < cutoff)) {
      await deleteMediaAsset(document);
      removed += 1;
    }
  }
  return removed;
}

async function sweepOrphanMedia(): Promise<void> {
  if (!isAdminConfigured()) return;
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const snapshot = await adminDb.collection('media_assets').where('status', '==', 'ready').limit(500).get();
  for (const document of snapshot.docs) {
    const data = document.data();
    if (Date.parse(String(data.createdAt || '')) >= cutoff) continue;
    const site = await adminDb.collection('users').doc(String(data.userId || '')).collection('sites').doc(String(data.siteId || '')).get();
    const referencedInSite = collectMediaIds(site.data() || {}).includes(document.id);
    const products = await adminDb.collection('creator_products').where('creatorId', '==', String(data.userId || '')).where('siteId', '==', String(data.siteId || '')).limit(500).get();
    const referencedInProduct = products.docs.some((product) => collectMediaIds({ imageUrls: product.data()?.imageUrls }).includes(document.id));
    if (!referencedInSite && !referencedInProduct) await deleteMediaAsset(document);
  }
}

async function signedMediaUrl(pathValue: string): Promise<string> {
  const [url] = await adminStorage.file(pathValue).getSignedUrl({
    action: 'read',
    expires: new Date(Date.now() + MEDIA_SIGNED_URL_TTL_MS)
  });
  return url;
}

function validGalleryItem(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false;
  const value = item as Record<string, unknown>;
  return typeof value.id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value.id)
    && typeof value.src === 'string' && value.src.length <= 4000 && isSafePublicUrl(value.src)
    && (value.thumbnail === undefined || (typeof value.thumbnail === 'string' && value.thumbnail.length <= 4000 && isSafePublicUrl(value.thumbnail)))
    && (value.alt === undefined || (typeof value.alt === 'string' && value.alt.length <= 300))
    && (value.caption === undefined || (typeof value.caption === 'string' && value.caption.length <= 500))
    && (value.type === undefined || value.type === 'image' || value.type === 'video');
}

export function validateSiteEntitlements(site: Record<string, any>, profile: DocumentData | undefined): { feature: string; message: string; details?: Record<string, string> } | null {
  const capabilities = getPlanCapabilities(profile as any);
  const tier = getPlanTier(profile as any);
  const templateId = typeof site.templateId === 'string' ? site.templateId.trim().toLowerCase() : '';
  if (!templatesData.some((template) => template.id === templateId)) return { feature: 'template', message: 'This template is not available.' };
  if (isPremiumTemplate(templateId) && !capabilities.premiumTemplates) return { feature: 'premiumTemplates', message: 'Premium templates require a Pro or Studio plan.', details: { templateId } };
  if (!Array.isArray(site.links) || site.links.length > capabilities.maxLinks) return { feature: 'links', message: `Your ${tier} plan allows up to ${capabilities.maxLinks} links.` };
  if (siteMediaCount(site) > capabilities.maxMedia) return { feature: 'media', message: `Your ${tier} plan allows up to ${capabilities.maxMedia} media assets.` };
  if (typeof site.bgStyle === 'string' && !capabilities.allowedBackgroundStyles.includes(site.bgStyle)) return { feature: 'backgroundStyle', message: 'This background style is not included in your plan.', details: { value: site.bgStyle } };
  for (const [field, allowed] of Object.entries(capabilities.allowedDesignOptions)) {
    if (site[field] !== undefined && !allowed.includes(site[field])) return { feature: field, message: `This ${field} option is not included in your plan.`, details: { value: String(site[field]) } };
  }
  if (Array.isArray(site.links)) {
    const invalidType = site.links.find((link) => !isSupportedBlockType(link?.type || 'link'));
    if (invalidType) return { feature: 'blockType', message: 'This block type is not supported.', details: { value: String(invalidType.type || 'link') } };
    const invalidGallery = site.links.find((link) => link?.type === 'gallery' && (!Array.isArray(link.galleryItems) || link.galleryItems.length < 1 || link.galleryItems.length > 50 || link.galleryItems.some((item: unknown) => !validGalleryItem(item)) || new Set(link.galleryItems.map((item: any) => item.id)).size !== link.galleryItems.length));
    if (invalidGallery) return { feature: 'gallery', message: 'Each gallery must contain 1 to 50 valid image or video items.' };
    const blocked = site.links.find((link) => !capabilities.allowedBlockTypes.includes(String(link?.type || 'link')));
    if (blocked) return { feature: 'blockType', message: 'This block type is not included in your plan.', details: { value: String(blocked.type || 'link') } };
    const invalidEmbed = site.links.find((link) => (link?.type === 'video' || link?.type === 'music') && !isSupportedEmbedUrl(link.type, link.url));
    if (invalidEmbed) return { feature: 'blockMedia', message: 'Video and music blocks must use a supported YouTube, Vimeo, Spotify, or SoundCloud URL.' };
  }
  if (!capabilities.removeBranding && site.hidePoweredBy === true) return { feature: 'removeBranding', message: 'Removing RALOA branding requires a Pro or Studio plan.' };
  if (!capabilities.customDomains && typeof site.customDomain === 'string' && site.customDomain.trim()) return { feature: 'customDomains', message: 'Custom domains require a Pro or Studio plan.' };
  if (!capabilities.analytics && (site.ga4Id || site.metaPixelId)) return { feature: 'analyticsIntegrations', message: 'Analytics integrations require a Pro or Studio plan.' };
  if (!capabilities.studioControls && (site.webhookUrl || site.bookingConfig?.calendarProvider && site.bookingConfig.calendarProvider !== 'none')) return { feature: 'studioControls', message: 'These advanced integrations require the Studio plan.' };
  return null;
}

async function consumeDistributedRateLimit(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; retryAfter: number }> {
  if (!isAdminConfigured()) return { allowed: true, retryAfter: 0 };
  const bucketId = crypto.createHash('sha256').update(key).digest('hex');
  const bucketRef = adminDb.collection('rate_limits').doc(bucketId);
  const now = Date.now();
  return adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(bucketRef);
    const current = snapshot.data() || {};
    const windowStart = typeof current.windowStart === 'number' && now - current.windowStart < windowMs ? current.windowStart : now;
    const count = windowStart === current.windowStart ? Number(current.count || 0) : 0;
    const allowed = count < limit;
    if (allowed) transaction.set(bucketRef, { windowStart, count: count + 1, updatedAt: new Date().toISOString() });
    return { allowed, retryAfter: Math.ceil((windowStart + windowMs - now) / 1000) };
  });
}

function domainDnsRecords(result: any): CustomDomainDnsRecord[] {
  const records = result?.ownership_verification?.http || result?.ownership_verification?.dns || [];
  if (Array.isArray(records)) return records.map((record: any) => ({
    type: record.type || 'CNAME',
    name: record.name || record.domain,
    value: record.value || record.data,
    is_verified: false
  }));
  return [];
}

// Password reset token store (FR-4.4: 15-minute TTL, 256-bit entropy)
export const PASSWORD_RESET_TOKENS = new Map<string, { email: string; expiresAt: number }>();
export const FORGOT_PW_RATE_LIMITS = new Map<string, number[]>();

function signSessionPayload(payload: string): string {
  return crypto.createHmac('sha256', AUTH_SESSION_SECRET).update(payload).digest('base64url');
}

async function createSignedSessionCookie(user: AuthenticatedUser, primaryHandle: string): Promise<string> {
  if (!AUTH_SESSION_SECRET) throw new Error('AUTH_SESSION_SECRET_NOT_CONFIGURED');
  const sessionId = crypto.randomUUID();
  const expiresAt = Date.now() + 604800000;
  const payload = Buffer.from(JSON.stringify({
    uid: user.uid,
    email: user.email || '',
    primary_handle: primaryHandle,
    sessionId,
    expiresAt
  })).toString('base64url');
  if (isAdminConfigured()) {
    await adminDb.collection('sessions').doc(sessionId).set({
      sessionId,
      userId: user.uid,
      email: user.email || null,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(expiresAt).toISOString()
    });
  }
  return `${payload}.${signSessionPayload(payload)}`;
}

async function verifySignedSessionCookie(token: string): Promise<(AuthenticatedUser & { primary_handle: string; sessionId: string }) | null> {
  if (!AUTH_SESSION_SECRET) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = signSessionPayload(payload);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      uid?: string;
      email?: string;
      primary_handle?: string;
      sessionId?: string;
      expiresAt?: number;
    };
    if (!parsed.uid || !parsed.sessionId || !parsed.expiresAt || parsed.expiresAt <= Date.now()) return null;
    if (isAdminConfigured()) {
      const session = await adminDb.collection('sessions').doc(parsed.sessionId).get();
      const data = session.data();
      if (!session.exists || data?.userId !== parsed.uid || Date.parse(String(data.expiresAt || '')) <= Date.now()) return null;
    }
    return {
      uid: parsed.uid,
      email: parsed.email,
      primary_handle: parsed.primary_handle || parsed.email?.split('@')[0] || 'creator',
      sessionId: parsed.sessionId
    };
  } catch {
    return null;
  }
}

function getRequestHost(req: Request): string {
  const forwardedHost = req.headers['x-forwarded-host'];
  const candidate = trustedProxyHops > 0 && typeof forwardedHost === 'string' && forwardedHost.trim()
    ? forwardedHost.split(',')[0].trim().toLowerCase()
    : (req.headers.host || '').split(':')[0].toLowerCase();
  if (!/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(candidate)) {
    return '';
  }
  return candidate;
}

/**
 * FR-1.1 Canonical Apex Redirect Middleware
 * All requests hitting http://* or https://www.raloa.app must resolve with a 301 Permanent Redirect to https://raloa.app/.
 */
app.use((req: Request, res: Response, next: NextFunction) => {
  const host = getRequestHost(req);
  if (!host) return apiError(res, 400, 'INVALID_HOST', 'The request host is invalid.');
  const forwardedProto = trustedProxyHops > 0 ? req.headers['x-forwarded-proto'] : undefined;

  // Check if hitting www.raloa.app or plain HTTP on raloa.app
  if (host === 'www.raloa.app') {
    return res.redirect(301, `https://raloa.app${req.originalUrl}`);
  }

  if (forwardedProto === 'http' && (host === 'raloa.app' || host === 'www.raloa.app')) {
    return res.redirect(301, `https://raloa.app${req.originalUrl}`);
  }

  next();
});


/**
 * FR-1.2 & NFR-4 Security & Edge Hardening Headers
 */
app.use((_req: Request, res: Response, next: NextFunction) => {
  // HSTS (Strict-Transport-Security)
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

  // MIME type sniffing protection
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // X-Frame-Options has no ALLOWALL value; keep previews protected by same-origin policy.
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Content-Security-Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' https://js.stripe.com https://apis.google.com; " +
    "style-src 'self' 'unsafe-inline' https:; " +
    "connect-src 'self' https: wss:; " +
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com; " +
    "font-src 'self' https: data:; " +
    "img-src 'self' https: data: blob:;"
  );
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self)');

  next();
});

/**
 * FR-2.1 & FR-2.2 Edge Attribution & UTM Parameter Capture
 */
app.use((req: Request, res: Response, next: NextFunction) => {
  // 1. Referral capture (?ref=...)
  const ref = req.query.ref;
  if (typeof ref === 'string' && ref.trim().length > 0) {
    const cleanRef = ref.trim().toUpperCase();
    const cookieDomain = req.hostname.endsWith('raloa.app') ? '; Domain=.raloa.app' : '';
    res.setHeader(
      'Set-Cookie',
      `_raloa_ref=${encodeURIComponent(cleanRef)}; Max-Age=2592000; Path=/; SameSite=Lax; Secure${cookieDomain}`
    );
  }

  // 2. UTM parameter capture
  const utmSource = req.query.utm_source;
  const utmMedium = req.query.utm_medium;
  const utmCampaign = req.query.utm_campaign;
  const utmTerm = req.query.utm_term;
  const utmContent = req.query.utm_content;

  if (utmSource || utmMedium || utmCampaign || utmTerm || utmContent) {
    let referrerHost: string | null = null;
    if (req.headers.referer) {
      try {
        referrerHost = new URL(req.headers.referer).hostname;
      } catch (_) {}
    }

    const payload = {
      utm_source: typeof utmSource === 'string' ? utmSource : null,
      utm_medium: typeof utmMedium === 'string' ? utmMedium : null,
      utm_campaign: typeof utmCampaign === 'string' ? utmCampaign : null,
      utm_term: typeof utmTerm === 'string' ? utmTerm : null,
      utm_content: typeof utmContent === 'string' ? utmContent : null,
      initial_landing_path: req.path,
      referrer_host: referrerHost,
      timestamp: Math.floor(Date.now() / 1000),
    };

    const cookieDomain = req.hostname.endsWith('raloa.app') ? '; Domain=.raloa.app' : '';
    const cookieValue = encodeURIComponent(JSON.stringify(payload));
    res.append(
      'Set-Cookie',
      `_raloa_utm=${cookieValue}; Max-Age=2592000; Path=/; SameSite=Lax; Secure${cookieDomain}`
    );
  }

  // 3. FR-2.3 In-App Browser (IAB) Detection
  const ua = req.headers['user-agent'] || '';
  if (/FBAN\/FBAV|Instagram/i.test(ua)) {
    res.setHeader('X-In-App-Browser', 'instagram');
  } else if (/musical_ly|ByteDance|TikTok/i.test(ua)) {
    res.setHeader('X-In-App-Browser', 'tiktok');
  } else if (/Twitter/i.test(ua)) {
    res.setHeader('X-In-App-Browser', 'twitter');
  }

  next();
});

/**
 * FR-3.3 Dynamic robots.txt Endpoint (AC-05)
 * Returns Disallow: /studio/, Disallow: /api/, Disallow: /login, Disallow: /register, Allow: /
 */
app.get('/robots.txt', (_req: Request, res: Response) => {
  res.type('text/plain');
  res.send(`# RALOA permits indexing of public marketing and creator profile pages.
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: Googlebot
Allow: /
User-agent: Bingbot
Allow: /
User-agent: Applebot-Extended
Allow: /
User-agent: Amazonbot
Allow: /
User-agent: FacebookBot
Allow: /
User-agent: Bytespider
Disallow: /

User-agent: *
Allow: /
Disallow: /studio/
Disallow: /api/
Disallow: /login
Disallow: /register
Disallow: /forgot-password
Disallow: /reset-password

Content-Signal: ai-train=yes, search=yes, ai-retrieval=yes

Sitemap: https://raloa.app/sitemap.xml
`);
});

app.get('/llms.txt', (_req: Request, res: Response) => {
  res.type('text/plain; charset=utf-8').send(PUBLIC_LLM_GUIDE);
});

/**
 * FR-3.3 Dynamic sitemap.xml Endpoint
 */
app.get('/sitemap.xml', async (_req: Request, res: Response) => {
  const pages = Object.keys(SEO_PAGES);
  const profiles: Array<{ handle: string; lastmod: string | null }> = publicDemoFixturesEnabled
    ? Object.entries(CREATORS_METADATA).map(([handle]) => ({ handle, lastmod: null }))
    : [];

  // In every persisted environment, only published sites are eligible for discovery.
  if (isAdminConfigured()) {
    try {
      const snapshot = await adminDb.collectionGroup('sites').where('isPublished', '==', true).get();
      const publishedHandles = new Map<string, { handle: string; lastmod: string | null }>();
      for (const document of snapshot.docs) {
        const data = document.data();
        const handle = normalizeSiteSlug(data.username);
        if (!handle) continue;
        const updatedAt = data.updatedAt || data.publishedAt || null;
        const lastmod = updatedAt ? new Date(updatedAt).toISOString().slice(0, 10) : null;
        publishedHandles.set(handle, { handle, lastmod });
      }
      profiles.splice(0, profiles.length, ...publishedHandles.values());
    } catch (error) {
      console.error('[Sitemap profiles]', error);
      profiles.splice(0, profiles.length);
    }
  }

  const urls = [...pages.map((route) => ({ loc: `https://raloa.app${route}`, lastmod: null })),
    ...profiles.map((profile) => ({ loc: `https://raloa.app/@${profile.handle}`, lastmod: profile.lastmod }))];
  const xml = urls.map(({ loc, lastmod }) => `<url><loc>${xmlEscape(loc)}</loc>${lastmod ? `<lastmod>${xmlEscape(lastmod)}</lastmod>` : ''}</url>`).join('');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${xml}</urlset>`);
});

/**
 * FR-1.3 Custom Domain Handshake & Edge Resolution
 * Handles CNAME/A record resolution and 526 SSL fallback (AC-06)
 */
app.use(async (req: Request, res: Response, next: NextFunction) => {
  // API and static asset requests must remain on their original paths when a
  // visitor is browsing through a custom hostname.
  if (req.path.startsWith('/api/') || req.path.startsWith('/assets/')) return next();

  const host = getRequestHost(req);
  const isPlatformDomain =
    host === 'raloa.app' ||
    host === 'www.raloa.app' ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.raloa.app');

  if (isPlatformDomain) {
    return next();
  }


  // Lookup in custom domain database
  const mapping = isAdminConfigured()
    ? await getCachedPublicDomain(host)
    : publicDemoFixturesEnabled
    ? CUSTOM_DOMAINS[host]
    : null;
  if (!mapping) {
    return res.status(404).send(`
      <!doctype html>
      <html>
        <head><title>404 - Domain Unregistered | RALOA Edge</title></head>
        <body style="font-family: system-ui, sans-serif; text-align: center; padding: 48px;">
          <h1>404 Domain Unregistered</h1>
          <p>The domain <strong>${host}</strong> is pointed to RALOA Anycast IPs, but is not attached to any published mini-site.</p>
          <a href="https://raloa.app">Return to RALOA</a>
        </body>
      </html>
    `);
  }

  // AC-06: Custom domain with invalid / pending SSL -> 526 Invalid SSL Screen
  const sslStatus = 'sslStatus' in mapping ? mapping.sslStatus : mapping.ssl_status;
  if (sslStatus === 'pending' || sslStatus === 'failed') {
    return res.status(526).send(`
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>526 Invalid SSL / Configuration Pending - ${host}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; background: #0b0f19; color: #f1f5f9; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; box-sizing: border-box; }
            .card { background: #131c2e; border: 1px solid #1e293b; border-radius: 24px; padding: 40px; max-width: 540px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
            .badge { display: inline-block; background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); font-size: 12px; font-weight: 700; padding: 6px 14px; border-radius: 999px; margin-bottom: 20px; }
            h1 { font-size: 24px; margin: 0 0 12px; }
            .hostname { font-family: monospace; color: #818cf8; font-size: 14px; background: rgba(99, 102, 241, 0.1); padding: 8px 16px; border-radius: 8px; display: inline-block; margin-bottom: 16px; }
            p { font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 24px; }
            .btn { display: inline-block; background: #6366f1; color: #fff; font-weight: 600; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-size: 14px; transition: background 0.2s; }
            .btn:hover { background: #4f46e5; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">HTTP 526 · Invalid SSL / Configuration Pending</div>
            <h1>SSL Certificate Handshake Pending</h1>
            <div class="hostname">${host}</div>
            <p>The custom domain is pointed to the RALOA Edge Network, but the automated Let's Encrypt / ZeroSSL certificate challenge has not yet completed or DNS propagation is pending.</p>
            <a class="btn" href="https://raloa.app/#faq">View Setup Documentation</a>
          </div>
        </body>
      </html>
    `);
  }

  const verificationStatus = 'verificationStatus' in mapping
    ? mapping.verificationStatus
    : ('is_active' in mapping && mapping.is_active && sslStatus === 'active' ? 'verified' : 'pending');
  if (verificationStatus !== 'verified' || sslStatus !== 'active') {
    return res.status(526).send(`
      <!doctype html><html lang="en"><head><meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Custom Domain Verification Pending - ${host}</title></head>
      <body style="font-family:system-ui,sans-serif;background:#0b0f19;color:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;box-sizing:border-box">
      <main style="background:#131c2e;border:1px solid #1e293b;border-radius:24px;padding:40px;max-width:540px;text-align:center">
      <h1>Custom domain verification is pending</h1><p style="color:#94a3b8;line-height:1.6">DNS verification and SSL activation must complete before this creator page is available.</p>
      <a href="https://raloa.app/#faq" style="display:inline-block;background:#6366f1;color:#fff;font-weight:600;padding:12px 24px;border-radius:999px;text-decoration:none">View setup instructions</a>
      </main></body></html>
    `);
  }

  // Active custom domain: resolve the exact owned, published site before
  // rewriting. This prevents a verified hostname from exposing another site.
  const siteHandle = 'siteHandle' in mapping ? mapping.siteHandle : undefined;
  const siteId = 'siteId' in mapping ? mapping.siteId : mapping.site_id;
  const siteUserId = 'userId' in mapping ? mapping.userId : mapping.user_id;
  const publishedSite = isAdminConfigured() && siteUserId && siteId
    ? await getPublishedSiteById(String(siteUserId), String(siteId)).catch(() => null)
    : null;
  if (isAdminConfigured() && !publishedSite) return res.status(404).send('Published site not found for this custom domain.');
  if (publishedSite) {
    const requestContext = req as Request & { customDomainSite?: Record<string, unknown>; customDomainHost?: string };
    requestContext.customDomainSite = publishedSite;
    requestContext.customDomainHost = host;
  }
  req.url = `/@${String(publishedSite?.handle || siteHandle || siteId)}`;
  next();
});

/**
 * FR-4.3 Studio Route Guarding Middleware
 * Any unauthenticated request attempting to reach /studio or /studio/* must be intercepted at the edge/middleware level.
 * Redirects visitor to /login?redirect=/studio (TC-M4-03).
 */
app.use(async (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/studio' || req.path.startsWith('/studio/')) {
    const session = await getAuthenticatedUser(req);
    const e2eBypass = process.env.NODE_ENV !== 'production' && process.env.E2E_TEST_MODE === 'true' && req.query.e2e === '1';
    if (!session && !e2eBypass) {
      return res.redirect(302, '/login?redirect=/studio');
    }
  }
  next();
});

/**
 * FR-2.1 Handle Claim Availability Endpoint
 * Debounced check querying GET /api/v1/handles/check?handle={name}
 * Regex: ^[a-zA-Z0-9_-]{3,30}$
 */
app.get('/api/v1/handles/check', async (req: Request, res: Response) => {
  const handle = req.query.handle;
  if (typeof handle !== 'string' || !handle.trim()) {
    return res.status(400).json({
      status: 'error',
      message: 'Handle query parameter is required'
    });
  }

  const clean = handle.trim().toLowerCase();
  const regex = /^[a-zA-Z0-9_-]{3,30}$/;

  if (!regex.test(clean)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid handle format. Handle must be 3-30 characters containing only alphanumeric characters, underscores, or hyphens.'
    });
  }

  const isReserved = RESERVED_HANDLES.has(clean);
  const isExistingCreator = publicDemoFixturesEnabled && !!CREATORS_METADATA[clean];
  const isExistingUser = Object.values(USERS_DB).some((u) => u.primary_handle.toLowerCase() === clean);
  const reservedSnapshot = isAdminConfigured()
    ? await adminDb.collection('handles').doc(clean).get()
    : null;

  const available = !isReserved && !isExistingCreator && !isExistingUser && !reservedSnapshot?.exists;

  return res.status(200).json({
    status: 'success',
    data: {
      handle: clean,
      available,
      reason: available ? undefined : 'Handle already registered or reserved'
    }
  });
});

app.post('/api/v1/handles/reserve', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  const handle = typeof req.body?.handle === 'string' ? req.body.handle.trim().toLowerCase() : '';
  if (!/^[a-z0-9_-]{3,30}$/.test(handle) || RESERVED_HANDLES.has(handle)) {
    return res.status(400).json({ error: 'Invalid or reserved handle' });
  }
  if (!isAdminConfigured()) return res.status(503).json({ error: 'Handle reservation is not configured' });

  try {
    const reservationRef = adminDb.collection('handles').doc(handle);
    const userRef = adminDb.collection('users').doc(user.uid);
    await adminDb.runTransaction(async (transaction) => {
      const [snapshot, userSnapshot] = await Promise.all([transaction.get(reservationRef), transaction.get(userRef)]);
      if (snapshot.exists && snapshot.data()?.userId !== user.uid) throw new Error('HANDLE_TAKEN');
      if (userSnapshot.exists && userSnapshot.data()?.handle && userSnapshot.data()?.handle !== handle) {
        throw new Error('HANDLE_CHANGE_REQUIRES_REVIEW');
      }
      transaction.set(reservationRef, { userId: user.uid, handle, updatedAt: new Date().toISOString() }, { merge: true });
      transaction.set(userRef, { handle, updatedAt: new Date().toISOString() }, { merge: true });
    });
    return res.status(200).json({ handle });
  } catch (error) {
    if (error instanceof Error && error.message === 'HANDLE_TAKEN') return res.status(409).json({ error: 'Handle is already taken' });
    if (error instanceof Error && error.message === 'HANDLE_CHANGE_REQUIRES_REVIEW') return res.status(409).json({ error: 'Handle changes require account review' });
    console.error('[Handle reservation]', error);
    return res.status(503).json({ error: 'Handle reservation is temporarily unavailable' });
  }
});

app.get('/api/v1/public/scheduling/:handle/config', async (req: Request, res: Response) => {
  const handle = String(req.params.handle || '').trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,30}$/.test(handle)) return apiError(res, 400, 'INVALID_HANDLE', 'Invalid creator handle.');
  if (!isAdminConfigured()) return apiError(res, 503, 'SCHEDULING_UNAVAILABLE', 'Scheduling is not configured.');
  const site = await getPublishedSiteByHandle(handle).catch(() => null);
  const config = normalizeBookingConfig(site?.bookingConfig);
  if (!site || !config.enabled || config.services.length === 0) return apiError(res, 404, 'SCHEDULING_DISABLED', 'This creator has not enabled scheduling.');
  return res.status(200).json({ handle, timezone: config.timezone, today: dateInTimeZone(new Date(), config.timezone), services: config.services, bookingWindowDays: config.bookingWindowDays });
});

app.get('/api/v1/public/scheduling/:handle/availability', async (req: Request, res: Response) => {
  const handle = String(req.params.handle || '').trim().toLowerCase();
  const from = typeof req.query.from === 'string' ? req.query.from : dateInTimeZone(new Date(), 'UTC');
  const to = typeof req.query.to === 'string' ? req.query.to : from;
  const serviceId = typeof req.query.serviceId === 'string' ? req.query.serviceId.trim().toLowerCase() : '';
  if (!/^[a-z0-9_-]{3,30}$/.test(handle) || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || !/^[a-z0-9_-]{1,64}$/.test(serviceId)) {
    return apiError(res, 400, 'INVALID_AVAILABILITY_REQUEST', 'Valid handle, date range, and service are required.');
  }
  if (Date.parse(`${to}T00:00:00Z`) < Date.parse(`${from}T00:00:00Z`) || Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) > 31 * 86400000) {
    return apiError(res, 400, 'INVALID_DATE_RANGE', 'Availability range must be between one and 31 days.');
  }
  if (!isAdminConfigured()) return apiError(res, 503, 'SCHEDULING_UNAVAILABLE', 'Scheduling is not configured.');
  const site = await getPublishedSiteByHandle(handle).catch(() => null);
  const config = normalizeBookingConfig(site?.bookingConfig);
  const service = config.services.find((item) => item.id === serviceId);
  if (!site || !config.enabled || !service) return apiError(res, 404, 'SERVICE_NOT_FOUND', 'The requested booking service is unavailable.');
  const rangeFrom = Date.parse(`${from}T00:00:00.000Z`) - 86400000;
  const rangeTo = Date.parse(`${to}T00:00:00.000Z`) + 2 * 86400000;
  const existing = await bookingRecordsForHost(String(site.userId), String(site.id || ''), rangeFrom, rangeTo);
  return res.status(200).json({ timezone: config.timezone, service, slots: availableSlots(config, service, from, to, existing) });
});

app.post('/api/v1/public/bookings', async (req: Request, res: Response) => {
  const hostHandle = typeof req.body?.hostHandle === 'string' ? req.body.hostHandle.trim().toLowerCase() : '';
  const serviceId = typeof req.body?.serviceId === 'string' ? req.body.serviceId.trim().toLowerCase() : '';
  const slotStart = typeof req.body?.slotStart === 'string' ? req.body.slotStart : '';
  const customerName = typeof req.body?.customerName === 'string' ? req.body.customerName.trim().slice(0, 120) : '';
  const customerEmail = typeof req.body?.customerEmail === 'string' ? req.body.customerEmail.trim().toLowerCase() : '';
  const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim().slice(0, 2000) : '';
  if (!/^[a-z0-9_-]{3,30}$/.test(hostHandle) || !/^[a-z0-9_-]{1,64}$/.test(serviceId) || !customerName || !validEmail(customerEmail)) {
    return apiError(res, 400, 'INVALID_BOOKING', 'A valid host, service, name, and email are required.');
  }
  const parsedStart = new Date(slotStart);
  if (!Number.isFinite(parsedStart.getTime())) return apiError(res, 400, 'INVALID_SLOT', 'A valid availability slot is required.');
  if (!isAdminConfigured()) return apiError(res, 503, 'SCHEDULING_UNAVAILABLE', 'Scheduling is not configured.');
  const hostSite = await getPublishedSiteByHandle(hostHandle).catch(() => null);
  const config = normalizeBookingConfig(hostSite?.bookingConfig);
  const service = config.services.find((item) => item.id === serviceId);
  if (!hostSite || !config.enabled || !service) return apiError(res, 404, 'SCHEDULING_DISABLED', 'This booking service is unavailable.');
  const rate = await enforceRateLimitPolicy('publicBooking', { ip: clientIdentity(req), site: hostHandle });
  if (!rate.allowed) return res.status(429).set('Retry-After', String(rate.retryAfter)).json({ error: 'Too many booking requests', retry_after: rate.retryAfter });
  const idempotencyKey = req.headers['idempotency-key'];
  if (typeof idempotencyKey !== 'string') return apiError(res, 400, 'IDEMPOTENCY_REQUIRED', 'Idempotency-Key header is required.');
  try {
    const claimed = await claimIdempotency('booking', idempotencyKey);
    if (claimed.inProgress) return apiError(res, 409, 'IDEMPOTENCY_IN_PROGRESS', 'A booking with this idempotency key is already being processed.');
    if (claimed.replay && claimed.response) return res.status(201).json(claimed.response);
    const localDate = dateInTimeZone(parsedStart, config.timezone);
    const rangeFrom = Date.parse(`${localDate}T00:00:00.000Z`) - 86400000;
    const rangeTo = Date.parse(`${localDate}T00:00:00.000Z`) + 2 * 86400000;
    const existing = await bookingRecordsForHost(String(hostSite.userId), String(hostSite.id || ''), rangeFrom, rangeTo);
    const slots = availableSlots(config, service, localDate, localDate, existing);
    const selected = slots.find((slot) => slot.start === parsedStart.toISOString());
    if (!selected) return apiError(res, 409, 'SLOT_UNAVAILABLE', 'That slot is no longer available.');
    const slotEnd = new Date(selected.end);
    const bookingReference = adminDb.collection('bookings').doc();
    const lockReferences: DocumentReference[] = [];
    for (let cursor = Math.floor(parsedStart.getTime() / 900000) * 900000; cursor < slotEnd.getTime() + config.bufferMinutes * 60000; cursor += 900000) {
      const lockId = crypto.createHash('sha256').update(`${hostSite.userId}:${cursor}`).digest('hex');
      lockReferences.push(adminDb.collection('booking_locks').doc(lockId));
    }
    const now = new Date().toISOString();
    const booking = {
      id: bookingReference.id,
      hostHandle,
      hostUserId: String(hostSite.userId),
      siteId: String(hostSite.id || ''),
      serviceId: service.id,
      serviceName: service.name,
      durationMinutes: service.durationMinutes,
      timezone: config.timezone,
      localDate,
      localTime: selected.localTime,
      slotStart: selected.start,
      slotEnd: selected.end,
      slotStartMs: parsedStart.getTime(),
      slotEndMs: slotEnd.getTime(),
      customerName,
      customerEmail,
      notes,
      status: 'pending_confirmation',
      confirmationStatus: 'pending',
      lockIds: lockReferences.map((reference) => reference.id),
      createdAt: now,
      updatedAt: now
    };
    const hostProfile = await adminDb.collection('users').doc(String(hostSite.userId)).get();
    const hostEmail = typeof hostProfile.data()?.email === 'string' ? hostProfile.data()?.email : '';
    const notifications = [
      { audience: 'customer', email: customerEmail, type: 'booking_request_received' },
      ...(hostEmail ? [{ audience: 'creator', email: hostEmail, type: 'booking_request' }] : [])
    ];
    const notificationReferences = notifications.map(() => adminDb.collection('notification_jobs').doc());
    const calendarProvider = config.calendarProvider || 'none';
    const calendarReady = calendarProvider !== 'none' && calendarProviderIsConfigured(calendarProvider as CalendarProvider);
    const calendarJob: Record<string, unknown> = {
      bookingId: bookingReference.id,
      provider: calendarProvider,
      status: calendarProvider === 'none' ? 'skipped' : calendarReady ? 'awaiting_confirmation' : 'blocked',
      createdAt: now
    };
    if (calendarProvider !== 'none' && !calendarReady) calendarJob.lastError = 'CALENDAR_PROVIDER_NOT_CONFIGURED';
    const calendarReference = adminDb.collection('calendar_jobs').doc();
    const bookingCreatedEvent = createOutboxEvent({ id: outboxEventId(`booking:${bookingReference.id}:created`), eventType: eventType(DOMAIN_EVENTS.BookingCreated), aggregateType: 'booking', aggregateId: bookingReference.id, idempotencyKey: `booking:${bookingReference.id}:created`, payload: { bookingId: bookingReference.id, hostUserId: booking.hostUserId, siteId: booking.siteId } });
    await adminDb.runTransaction(async (transaction) => {
      const locks = await Promise.all(lockReferences.map((reference) => transaction.get(reference)));
      if (locks.some((lock) => lock.exists)) throw new Error('BOOKING_SLOT_TAKEN');
      for (const reference of lockReferences) transaction.create(reference, { bookingId: bookingReference.id, hostUserId: hostSite.userId, createdAt: now });
      transaction.create(bookingReference, booking);
      notifications.forEach((notification, index) => transaction.create(notificationReferences[index], { ...notification, bookingId: bookingReference.id, status: 'pending', attempts: 0, maxAttempts: 8, createdAt: now }));
      transaction.create(calendarReference, calendarJob);
      appendOutboxEvent(transaction, adminDb, bookingCreatedEvent);
    });
    const response = { id: bookingReference.id, status: booking.status, confirmationStatus: booking.confirmationStatus, timezone: config.timezone, slotStart: booking.slotStart, slotEnd: booking.slotEnd };
    await completeIdempotency('booking', idempotencyKey, response);
    return res.status(201).json(response);
  } catch (error) {
    if (error instanceof Error && error.message === 'BOOKING_SLOT_TAKEN') return apiError(res, 409, 'SLOT_UNAVAILABLE', 'That slot is no longer available.');
    console.error('[Public booking]', error);
    return apiError(res, 503, 'BOOKING_UNAVAILABLE', 'Booking service is temporarily unavailable.');
  }
});

app.get('/api/creator/bookings', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  if (!isAdminConfigured()) return apiError(res, 503, 'BOOKINGS_UNAVAILABLE', 'Booking management is not configured.');
  const siteId = typeof req.query.siteId === 'string' ? req.query.siteId.trim() : '';
  if (!siteId) return apiError(res, 400, 'SITE_ID_REQUIRED', 'A site ID is required.');
  const site = await adminDb.collection('users').doc(user.uid).collection('sites').doc(siteId).get();
  if (!site.exists) return apiError(res, 404, 'SITE_NOT_FOUND', 'Site not found.');
  const requestedLimit = Number(req.query.limit || 50);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
  const cursor = req.query.cursor ? decodePageCursor(req.query.cursor) : null;
  if (req.query.cursor && !cursor) return apiError(res, 400, 'INVALID_CURSOR', 'The bookings page cursor is invalid or expired.');
  let query: Query = adminDb.collection('bookings').where('hostUserId', '==', user.uid).orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc').limit(limit + 1);
  if (cursor) query = query.startAfter(cursor.createdAt, cursor.id);
  const snapshot = await query.get();
  const bookings = await Promise.all(snapshot.docs
    .filter((document) => String(document.data()?.siteId || '') === siteId)
    .map(async (document) => ({ id: document.id, ...document.data(), delivery: await bookingDeliveryStatus(document.id) }))) as Array<Record<string, any>>;
  const lastScanned = snapshot.docs[snapshot.docs.length - 1];
  return res.json({
    bookings: bookings.slice(0, limit),
    hasMore: snapshot.docs.length > limit,
    nextCursor: snapshot.docs.length > limit && lastScanned ? encodePageCursor({ createdAt: String(lastScanned.data()?.createdAt || ''), id: lastScanned.id }) : null
  });
});

app.post('/api/creator/bookings/:bookingId/confirm', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  if (!isAdminConfigured()) return apiError(res, 503, 'BOOKINGS_UNAVAILABLE', 'Booking management is not configured.');
  const bookingRef = adminDb.collection('bookings').doc(String(req.params.bookingId || ''));
  const bookingSnapshot = await bookingRef.get();
  if (!bookingSnapshot.exists || bookingSnapshot.data()?.hostUserId !== user.uid) return apiError(res, 404, 'BOOKING_NOT_FOUND', 'Booking not found.');
  const booking = bookingSnapshot.data() || {};
  const bookingSite = await getOwnedSite(user.uid, String(booking.siteId || ''));
  if (!bookingSite || (typeof req.query.siteId === 'string' && bookingSite.id !== req.query.siteId.trim())) return apiError(res, 404, 'BOOKING_NOT_FOUND', 'Booking not found.');
  if (booking.status === 'cancelled') return apiError(res, 409, 'BOOKING_CANCELLED', 'Cancelled bookings cannot be confirmed.');
  if (booking.status !== 'confirmed') {
    const confirmedEvent = createOutboxEvent({ id: outboxEventId(`booking:${bookingRef.id}:confirmed`), eventType: eventType(DOMAIN_EVENTS.BookingConfirmed), aggregateType: 'booking', aggregateId: bookingRef.id, idempotencyKey: `booking:${bookingRef.id}:confirmed`, payload: { bookingId: bookingRef.id, siteId: String(booking.siteId || '') } });
    await adminDb.runTransaction(async (transaction) => {
      const current = await transaction.get(bookingRef);
      if (!current.exists || current.data()?.status === 'cancelled') throw new Error('BOOKING_CANCELLED');
      transaction.set(bookingRef, { status: 'confirmed', confirmationStatus: 'confirmed', confirmedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true });
      appendOutboxEvent(transaction, adminDb, confirmedEvent);
    });
  }
  const customerEmail = String(booking.customerEmail || '');
  await adminDb.collection('notification_jobs').add({ audience: 'customer', email: customerEmail, type: 'booking_confirmed', bookingId: bookingRef.id, status: 'pending', attempts: 0, maxAttempts: 8, createdAt: new Date().toISOString() });
  void backgroundJobs.enqueue({ kind: 'email_delivery', idempotencyKey: `booking:${bookingRef.id}:confirmed`, payload: { bookingId: bookingRef.id } }).catch((error) => console.error('[Background job enqueue]', error));
  const hostSite = await getPublishedSiteByHandle(String(booking.hostHandle || '')).catch(() => null);
  const provider = String((hostSite?.bookingConfig as Record<string, unknown> | undefined)?.calendarProvider || 'none') as CalendarProvider | 'none';
  if (provider !== 'none') {
    const calendarRef = adminDb.collection('calendar_jobs').where('bookingId', '==', bookingRef.id).limit(1);
    const jobs = await calendarRef.get();
    if (!jobs.empty) await jobs.docs[0].ref.set({ status: calendarProviderIsConfigured(provider) ? 'pending' : 'blocked', operation: 'create', lastError: calendarProviderIsConfigured(provider) ? null : 'CALENDAR_PROVIDER_NOT_CONFIGURED', updatedAt: new Date().toISOString() }, { merge: true });
    if (calendarProviderIsConfigured(provider)) void backgroundJobs.enqueue({ kind: 'calendar_sync', idempotencyKey: `booking:${bookingRef.id}:calendar`, payload: { bookingId: bookingRef.id } }).catch((error) => console.error('[Background job enqueue]', error));
  }
  return res.json({ id: bookingRef.id, status: 'confirmed', confirmationStatus: 'confirmed' });
});

app.post('/api/creator/bookings/:bookingId/cancel', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  if (!isAdminConfigured()) return apiError(res, 503, 'BOOKINGS_UNAVAILABLE', 'Booking management is not configured.');
  const bookingRef = adminDb.collection('bookings').doc(String(req.params.bookingId || ''));
  const existing = await bookingRef.get();
  if (!existing.exists || existing.data()?.hostUserId !== user.uid) return apiError(res, 404, 'BOOKING_NOT_FOUND', 'Booking not found.');
  const booking = existing.data() || {};
  const bookingSite = await getOwnedSite(user.uid, String(booking.siteId || ''));
  if (!bookingSite || (typeof req.query.siteId === 'string' && bookingSite.id !== req.query.siteId.trim())) return apiError(res, 404, 'BOOKING_NOT_FOUND', 'Booking not found.');
  if (booking.status === 'cancelled') return res.json({ id: bookingRef.id, status: 'cancelled', confirmationStatus: 'cancelled' });
  const cancelledEvent = createOutboxEvent({ id: outboxEventId(`booking:${bookingRef.id}:cancelled`), eventType: eventType(DOMAIN_EVENTS.BookingCancelled), aggregateType: 'booking', aggregateId: bookingRef.id, idempotencyKey: `booking:${bookingRef.id}:cancelled`, payload: { bookingId: bookingRef.id, siteId: String(booking.siteId || '') } });
  await adminDb.runTransaction(async (transaction) => {
    const current = await transaction.get(bookingRef);
    if (!current.exists || current.data()?.hostUserId !== user.uid || current.data()?.status === 'cancelled') return;
    const lockIds = Array.isArray(current.data()?.lockIds) ? current.data()?.lockIds : [];
    transaction.update(bookingRef, { status: 'cancelled', confirmationStatus: 'cancelled', cancelledAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    for (const lockId of lockIds) if (typeof lockId === 'string') transaction.delete(adminDb.collection('booking_locks').doc(lockId));
    appendOutboxEvent(transaction, adminDb, cancelledEvent);
  });
  const calendarJobs = await adminDb.collection('calendar_jobs').where('bookingId', '==', bookingRef.id).limit(1).get();
  if (!calendarJobs.empty) {
    const job = calendarJobs.docs[0];
    const data = job.data();
    await job.ref.set(data.externalEventId ? { status: 'pending', operation: 'cancel', updatedAt: new Date().toISOString() } : { status: 'cancelled', updatedAt: new Date().toISOString() }, { merge: true });
  }
  await adminDb.collection('notification_jobs').add({ audience: 'customer', email: String(booking.customerEmail || ''), type: 'booking_cancelled', bookingId: bookingRef.id, status: 'pending', attempts: 0, maxAttempts: 8, createdAt: new Date().toISOString() });
  void backgroundJobs.enqueue({ kind: 'email_delivery', idempotencyKey: `booking:${bookingRef.id}:cancelled`, payload: { bookingId: bookingRef.id } }).catch((error) => console.error('[Background job enqueue]', error));
  if (!calendarJobs.empty && calendarJobs.docs[0].data()?.externalEventId) void backgroundJobs.enqueue({ kind: 'calendar_sync', idempotencyKey: `booking:${bookingRef.id}:cancel`, payload: { bookingId: bookingRef.id } }).catch((error) => console.error('[Background job enqueue]', error));
  return res.json({ id: bookingRef.id, status: 'cancelled', confirmationStatus: 'cancelled' });
});

app.post('/api/v1/public/newsletter', async (req: Request, res: Response) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const siteHandle = typeof req.body?.siteHandle === 'string' ? req.body.siteHandle.trim().toLowerCase() : '';
  if (!validEmail(email)) return res.status(400).json({ error: 'A valid email is required' });
  const rate = await enforceRateLimitPolicy('publicForms', { ip: clientIdentity(req), site: siteHandle || 'unknown' });
  if (!rate.allowed) return res.status(429).set('Retry-After', String(rate.retryAfter)).json({ error: 'Too many newsletter requests', retry_after: rate.retryAfter });
  try {
    if (!isAdminConfigured()) return res.status(503).json({ error: 'Newsletter service is not configured' });
    if (siteHandle) {
      const site = await getPublishedAudienceSite(siteHandle);
      if (!site) return apiError(res, 404, 'PUBLIC_SITE_NOT_FOUND', 'Published site not found.');
      const now = new Date().toISOString();
      const id = crypto.createHash('sha256').update(`${site.userId}:${site.id}:${email}`).digest('hex').slice(0, 40);
      const reference = adminDb.collection('audience_subscribers').doc(id);
      const existing = await reference.get();
      await reference.set({ creatorUserId: site.userId, siteId: site.id, siteHandle: site.handle, email, source: 'Public profile', status: 'active', createdAt: existing.data()?.createdAt || now, updatedAt: now }, { merge: true });
      return res.status(200).json({ id: reference.id });
    }
    const id = crypto.createHash('sha256').update(email).digest('hex').slice(0, 32);
    const reference = adminDb.collection('newsletter_subscribers').doc(id);
    await reference.set({ email, createdAt: new Date().toISOString() }, { merge: true });
    return res.status(200).json({ id: reference.id });
  } catch (error) {
    console.error('[Newsletter signup]', error);
    return res.status(503).json({ error: 'Newsletter service is temporarily unavailable' });
  }
});

type AudienceRecordKind = 'subscribers' | 'submissions';

function audienceKind(value: unknown): AudienceRecordKind | null {
  return value === 'subscribers' || value === 'submissions' ? value : null;
}

function validAudienceDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function encodePageCursor(value: { createdAt: string; id: string }): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodePageCursor(value: unknown): { createdAt: string; id: string } | null {
  if (typeof value !== 'string' || value.length > 512) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<string, unknown>;
    return typeof parsed.createdAt === 'string' && typeof parsed.id === 'string' ? { createdAt: parsed.createdAt, id: parsed.id } : null;
  } catch {
    return null;
  }
}

async function getOwnedAudienceSite(user: AuthenticatedUser, requestedHandle?: string, requestedSiteId?: string): Promise<{ id: string; handle: string } | null> {
  if (!isAdminConfigured()) return null;
  const profileRef = adminDb.collection('users').doc(user.uid);
  const profile = await profileRef.get();
  if (!profile.exists) return null;
  const profileHandle = String(profile.data()?.handle || '').trim().toLowerCase();
  const cleanHandle = String(requestedHandle || profileHandle).trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,30}$/.test(cleanHandle)) return null;

  const sites = profileRef.collection('sites');
  const ownedRequestedSite = requestedSiteId ? await getOwnedSite(user.uid, requestedSiteId) : null;
  const siteSnapshot = requestedSiteId
    ? { docs: ownedRequestedSite ? [ownedRequestedSite.snapshot] : [] } as any
    : await sites.where('username', '==', cleanHandle).limit(1).get();
  const site = siteSnapshot.docs[0];
  if (!site) return null;
  const siteHandle = String(site.data()?.username || '').trim().toLowerCase();
  if ((requestedSiteId && site.id !== requestedSiteId) || (requestedHandle && siteHandle !== cleanHandle)) return null;
  return { id: site.id, handle: cleanHandle };
}

async function getPublishedAudienceSite(handle: string): Promise<{ id: string; userId: string; handle: string } | null> {
  if (!isAdminConfigured()) return null;
  const published = await getPublishedSiteByHandle(handle);
  if (!published?.userId) return null;
  const cleanHandle = String(handle).trim().toLowerCase();
  const sites = await adminDb.collection('users').doc(String(published.userId)).collection('sites').where('isPublished', '==', true).limit(100).get();
  const site = sites.docs.find((document) => String(document.data()?.username || '').trim().toLowerCase() === cleanHandle);
  return site ? { id: site.id, userId: String(published.userId), handle: cleanHandle } : null;
}

function audienceCollection(kind: AudienceRecordKind) {
  return adminDb.collection(kind === 'subscribers' ? 'audience_subscribers' : 'audience_submissions');
}

function audienceRecordForResponse(kind: AudienceRecordKind, data: Record<string, unknown>, id: string): Record<string, unknown> {
  if (kind === 'subscribers') {
    return {
      id,
      email: String(data.email || ''),
      source: String(data.source || 'Public profile'),
      status: data.status === 'unsubscribed' ? 'unsubscribed' : 'active',
      createdAt: data.createdAt || null,
      updatedAt: data.updatedAt || null
    };
  }
  return {
    id,
    name: String(data.fullName || ''),
    email: String(data.email || ''),
    subject: String(data.subject || ''),
    message: String(data.message || ''),
    status: ['new', 'read', 'archived'].includes(String(data.status)) ? data.status : 'new',
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null
  };
}

async function listAudienceRecords(kind: AudienceRecordKind, site: { id: string; handle: string }, userId: string, search: string, status: string, from: string | null, to: string | null, limit: number, cursor: { createdAt: string; id: string } | null) {
  let query: Query = audienceCollection(kind)
    .where('creatorUserId', '==', userId)
    .orderBy('createdAt', 'desc')
    .orderBy(FieldPath.documentId(), 'desc')
    .limit(limit + 1);
  if (cursor) query = query.startAfter(cursor.createdAt, cursor.id);
  const snapshot = await query.get();
  const fromTime = from ? Date.parse(`${from}T00:00:00.000Z`) : 0;
  const toTime = to ? Date.parse(`${to}T00:00:00.000Z`) + 86400000 : Number.POSITIVE_INFINITY;
  const normalizedSearch = search.toLowerCase();
  const records = snapshot.docs
    .filter((document) => {
      const data = document.data() as Record<string, unknown>;
      if (String(data.siteId || '') !== site.id || String(data.siteHandle || '') !== site.handle) return false;
      const createdAt = Date.parse(String(data.createdAt || ''));
      if (!Number.isFinite(createdAt) || createdAt < fromTime || createdAt >= toTime) return false;
      const recordStatus = String(data.status || (kind === 'subscribers' ? 'active' : 'new'));
      if (status && recordStatus !== status) return false;
      if (!normalizedSearch) return true;
      const haystack = kind === 'subscribers'
        ? `${data.email || ''} ${data.source || ''}`
        : `${data.fullName || ''} ${data.email || ''} ${data.subject || ''} ${data.message || ''}`;
      return haystack.toLowerCase().includes(normalizedSearch);
    })
    .sort((a, b) => String(b.data()?.createdAt || '').localeCompare(String(a.data()?.createdAt || '')));
  const page = records.slice(0, limit);
  const last = page[page.length - 1];
  return {
    total: records.length,
    records: page.map((document) => audienceRecordForResponse(kind, document.data() as Record<string, unknown>, document.id)),
    hasMore: records.length > limit,
    nextCursor: records.length > limit && last ? encodePageCursor({ createdAt: String(last.data()?.createdAt || ''), id: last.id }) : null
  };
}

app.get('/api/creator/audience', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  if (!isAdminConfigured()) return apiError(res, 503, 'AUDIENCE_UNAVAILABLE', 'Audience data is not configured.');
  const kind = audienceKind(req.query.type || 'subscribers');
  if (!kind) return apiError(res, 400, 'INVALID_AUDIENCE_TYPE', 'Audience type must be subscribers or submissions.');
  const requestedHandle = typeof req.query.siteHandle === 'string' ? req.query.siteHandle : undefined;
  const requestedSiteId = typeof req.query.siteId === 'string' ? req.query.siteId : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 120) : '';
  const status = typeof req.query.status === 'string' ? req.query.status.trim().slice(0, 30) : '';
  const from = req.query.from ? (validAudienceDate(req.query.from) ? req.query.from : null) : null;
  const to = req.query.to ? (validAudienceDate(req.query.to) ? req.query.to : null) : null;
  if ((req.query.from && !from) || (req.query.to && !to) || (from && to && from > to)) return apiError(res, 400, 'INVALID_AUDIENCE_RANGE', 'Use a valid inclusive date range.');
  const requestedLimit = Number(req.query.limit || 100);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 100;
  const cursor = req.query.cursor ? decodePageCursor(req.query.cursor) : null;
  if (req.query.cursor && !cursor) return apiError(res, 400, 'INVALID_CURSOR', 'The audience page cursor is invalid or expired.');
  try {
    const site = await getOwnedAudienceSite(user, requestedHandle, requestedSiteId);
    if (!site) return apiError(res, 404, 'SITE_NOT_FOUND', 'The requested site was not found for this account.');
    const [list, subscriberSnapshot, submissionSnapshot, viewsSnapshot] = await Promise.all([
      listAudienceRecords(kind, site, user.uid, search, status, from, to, limit, cursor),
      audienceCollection('subscribers').where('creatorUserId', '==', user.uid).limit(5001).get(),
      audienceCollection('submissions').where('creatorUserId', '==', user.uid).limit(5001).get(),
      readAnalyticsEvents('page_views', user.uid, 10000)
    ]);
    const fromTime = from ? Date.parse(`${from}T00:00:00.000Z`) : 0;
    const toTime = to ? Date.parse(`${to}T00:00:00.000Z`) + 86400000 : Number.POSITIVE_INFINITY;
    const inSiteRange = (document: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = document.data();
      const createdAt = Date.parse(String(data.createdAt || ''));
      return String(data.siteId || '') === site.id && String(data.siteHandle || '') === site.handle && Number.isFinite(createdAt) && createdAt >= fromTime && createdAt < toTime;
    };
    const subscribers = subscriberSnapshot.docs.filter(inSiteRange);
    const submissions = submissionSnapshot.docs.filter(inSiteRange);
    const metricsCapped = subscriberSnapshot.size > 5000 || submissionSnapshot.size > 5000;
    const activeSubscribers = subscribers.filter((document) => document.data().status !== 'unsubscribed').length;
    const uniqueVisitors = new Set(viewsSnapshot.events.filter((document) => {
      const data = document.data();
      const timestamp = Date.parse(String(data.timestamp || ''));
      return String(data.siteHandle || '') === site.handle && Number.isFinite(timestamp) && timestamp >= fromTime && timestamp < toTime;
    }).map((document) => String(document.data().visitorIdHash || document.id)));
    const conversionRate = uniqueVisitors.size ? Number(((subscribers.length / uniqueVisitors.size) * 100).toFixed(2)) : null;
    return res.status(200).json({
      site,
      data: list.records,
      total: list.total,
      hasMore: list.hasMore,
      nextCursor: list.nextCursor,
      metricsCapped,
      metrics: {
        subscribers: subscribers.length,
        activeSubscribers,
        newSubscribers: subscribers.filter((document) => Date.parse(String(document.data().createdAt || '')) >= Date.now() - 30 * 86400000).length,
        submissions: submissions.length,
        newSubmissions: submissions.filter((document) => Date.parse(String(document.data().createdAt || '')) >= Date.now() - 30 * 86400000).length,
        uniqueVisitors: uniqueVisitors.size,
        conversionRate,
        capped: metricsCapped || viewsSnapshot.capped,
        truncated: metricsCapped || viewsSnapshot.capped
      },
      dateRange: { from, to }
    });
  } catch (error) {
    console.error('[Audience read]', error);
    return apiError(res, 503, 'AUDIENCE_UNAVAILABLE', 'Audience data is temporarily unavailable.');
  }
});

app.post('/api/creator/audience/subscribers', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  if (!isAdminConfigured()) return apiError(res, 503, 'AUDIENCE_UNAVAILABLE', 'Audience data is not configured.');
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const source = typeof req.body?.source === 'string' ? req.body.source.trim().slice(0, 120) : 'Manual Entry';
  if (!validEmail(email)) return apiError(res, 400, 'INVALID_EMAIL', 'A valid email is required.');
  try {
    const site = await getOwnedAudienceSite(user, typeof req.body?.siteHandle === 'string' ? req.body.siteHandle : undefined, typeof req.body?.siteId === 'string' ? req.body.siteId : undefined);
    if (!site) return apiError(res, 404, 'SITE_NOT_FOUND', 'The requested site was not found for this account.');
    const now = new Date().toISOString();
    const id = crypto.createHash('sha256').update(`${user.uid}:${site.id}:${email}`).digest('hex').slice(0, 40);
    const reference = adminDb.collection('audience_subscribers').doc(id);
    const existing = await reference.get();
    await reference.set({ creatorUserId: user.uid, siteId: site.id, siteHandle: site.handle, email, source: source || 'Manual Entry', status: 'active', createdAt: existing.data()?.createdAt || now, updatedAt: now }, { merge: true });
    return res.status(201).json({ data: audienceRecordForResponse('subscribers', { email, source: source || 'Manual Entry', status: 'active', createdAt: now, updatedAt: now }, id) });
  } catch (error) {
    console.error('[Audience subscriber create]', error);
    return apiError(res, 503, 'AUDIENCE_WRITE_FAILED', 'The subscriber could not be saved.');
  }
});

app.patch('/api/creator/audience/:kind/:id', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  if (!isAdminConfigured()) return apiError(res, 503, 'AUDIENCE_UNAVAILABLE', 'Audience data is not configured.');
  const kind = audienceKind(req.params.kind);
  if (!kind) return apiError(res, 400, 'INVALID_AUDIENCE_TYPE', 'Invalid audience type.');
  const status = typeof req.body?.status === 'string' ? req.body.status : '';
  const allowedStatuses = kind === 'subscribers' ? ['active', 'unsubscribed'] : ['new', 'read', 'archived'];
  if (!allowedStatuses.includes(status)) return apiError(res, 400, 'INVALID_AUDIENCE_STATUS', 'Invalid audience status.');
  try {
    const reference = audienceCollection(kind).doc(String(req.params.id || ''));
    const snapshot = await reference.get();
    if (!snapshot.exists || snapshot.data()?.creatorUserId !== user.uid) return apiError(res, 404, 'AUDIENCE_RECORD_NOT_FOUND', 'Audience record not found.');
    const recordSite = await getOwnedSite(user.uid, String(snapshot.data()?.siteId || ''));
    const requestedSiteId = typeof req.body?.siteId === 'string' ? req.body.siteId.trim() : '';
    if (!recordSite || (requestedSiteId && requestedSiteId !== recordSite.id)) return apiError(res, 404, 'AUDIENCE_RECORD_NOT_FOUND', 'Audience record not found.');
    await reference.set({ status, updatedAt: new Date().toISOString(), ...(status === 'unsubscribed' ? { unsubscribedAt: new Date().toISOString() } : {}) }, { merge: true });
    return res.status(200).json({ data: audienceRecordForResponse(kind, { ...snapshot.data(), status }, reference.id) });
  } catch (error) {
    console.error('[Audience status update]', error);
    return apiError(res, 503, 'AUDIENCE_WRITE_FAILED', 'The audience record could not be updated.');
  }
});

app.delete('/api/creator/audience/:kind/:id', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  if (!isAdminConfigured()) return apiError(res, 503, 'AUDIENCE_UNAVAILABLE', 'Audience data is not configured.');
  const kind = audienceKind(req.params.kind);
  if (!kind) return apiError(res, 400, 'INVALID_AUDIENCE_TYPE', 'Invalid audience type.');
  try {
    const reference = audienceCollection(kind).doc(String(req.params.id || ''));
    const snapshot = await reference.get();
    if (!snapshot.exists || snapshot.data()?.creatorUserId !== user.uid) return apiError(res, 404, 'AUDIENCE_RECORD_NOT_FOUND', 'Audience record not found.');
    const recordSite = await getOwnedSite(user.uid, String(snapshot.data()?.siteId || ''));
    const requestedSiteId = typeof req.query.siteId === 'string' ? req.query.siteId.trim() : '';
    if (!recordSite || (requestedSiteId && requestedSiteId !== recordSite.id)) return apiError(res, 404, 'AUDIENCE_RECORD_NOT_FOUND', 'Audience record not found.');
    await reference.delete();
    return res.status(204).send();
  } catch (error) {
    console.error('[Audience delete]', error);
    return apiError(res, 503, 'AUDIENCE_WRITE_FAILED', 'The audience record could not be deleted.');
  }
});

app.get('/api/creator/audience/export', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  if (!isAdminConfigured()) return apiError(res, 503, 'AUDIENCE_UNAVAILABLE', 'Audience data is not configured.');
  const kind = audienceKind(req.query.type || 'subscribers');
  if (!kind) return apiError(res, 400, 'INVALID_AUDIENCE_TYPE', 'Invalid audience type.');
  try {
    const site = await getOwnedAudienceSite(user, typeof req.query.siteHandle === 'string' ? req.query.siteHandle : undefined, typeof req.query.siteId === 'string' ? req.query.siteId : undefined);
    if (!site) return apiError(res, 404, 'SITE_NOT_FOUND', 'The requested site was not found for this account.');
    const exportRate = await enforceRateLimitPolicy('imports', { ip: clientIdentity(req), user: user.uid, site: site.id });
    if (!exportRate.allowed) return res.status(429).set('Retry-After', String(exportRate.retryAfter)).json({ error: 'Too many audience export requests', retry_after: exportRate.retryAfter });
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 120) : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim().slice(0, 30) : '';
    const from = req.query.from && validAudienceDate(req.query.from) ? req.query.from : null;
    const to = req.query.to && validAudienceDate(req.query.to) ? req.query.to : null;
    const result = await listAudienceRecords(kind, site, user.uid, search, status, from, to, 10000, null);
    const format = req.query.format === 'csv' ? 'csv' : 'json';
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="raloa-${site.handle}-${kind}-${stamp}.json"`);
      return res.status(200).send(JSON.stringify(result.records, null, 2));
    }
    const columns = kind === 'subscribers' ? ['id', 'email', 'source', 'status', 'createdAt'] : ['id', 'name', 'email', 'subject', 'message', 'status', 'createdAt'];
    const csvEscape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [columns.join(','), ...result.records.map((record) => columns.map((column) => csvEscape(record[column])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="raloa-${site.handle}-${kind}-${stamp}.csv"`);
    return res.status(200).send(`\ufeff${csv}`);
  } catch (error) {
    console.error('[Audience export]', error);
    return apiError(res, 503, 'AUDIENCE_EXPORT_FAILED', 'The audience export could not be generated.');
  }
});

/**
 * FR-2.4 Contact Form Ingestion Endpoint
 * Rate-limited via IP bucket: Max 5 submissions per hour per IP.
 * Validates required payload fields: fullName, email, subject, message.
 */
app.post('/api/v1/public/contact', async (req: Request, res: Response) => {
  const ip = clientIdentity(req);
  const now = Date.now();
  const oneHourAgo = now - 3600000;

  // Rate limit: Max 5 submissions per hour per IP (FR-2.4)
  const timestamps = (CONTACT_RATE_LIMITS.get(ip) || []).filter((t) => t > oneHourAgo);
  const formLimit = await enforceRateLimitPolicy('publicForms', { ip, site: typeof req.body?.siteHandle === 'string' ? req.body.siteHandle.trim().toLowerCase() : 'unknown' });
  if ((!isAdminConfigured() && timestamps.length >= RATE_LIMIT_POLICIES.publicForms.limit) || (isAdminConfigured() && !formLimit.allowed)) {
    return res.status(429).json({
      status: 'error',
      error: 'Too Many Requests',
      message: 'Rate limit exceeded: maximum 5 contact inquiries per hour per IP.',
      retry_after: formLimit.retryAfter || 3600
    });
  }

  const { fullName, name, email, subject, message } = req.body || {};
  const contactName = fullName || name;
  const contactEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!contactName || typeof contactName !== 'string' || contactName.length > 120 || !validEmail(contactEmail) || typeof message !== 'string' || message.length < 1 || message.length > 5000) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing required fields: fullName/name, email, and message are required.'
    });
  }

  if (!isAdminConfigured()) {
    timestamps.push(now);
    CONTACT_RATE_LIMITS.set(ip, timestamps);
  }

  const submission = {
    id: `contact_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    fullName: contactName,
    email: contactEmail,
    subject: typeof subject === 'string' && subject.length <= 200 ? subject : 'General Inquiry',
    message,
    createdAt: new Date().toISOString()
  };
  if (isAdminConfigured()) {
    try {
      const siteHandle = typeof req.body?.siteHandle === 'string' ? req.body.siteHandle.trim().toLowerCase() : '';
      if (siteHandle) {
        const site = await getPublishedAudienceSite(siteHandle);
        if (!site) return apiError(res, 404, 'PUBLIC_SITE_NOT_FOUND', 'Published site not found.');
        const reference = adminDb.collection('audience_submissions').doc();
        await reference.set({
          creatorUserId: site.userId,
          siteId: site.id,
          siteHandle: site.handle,
          fullName: submission.fullName,
          email: submission.email,
          subject: submission.subject,
          message: submission.message,
          status: 'new',
          createdAt: submission.createdAt,
          updatedAt: submission.createdAt
        });
        return res.status(200).json({ status: 'success', message: 'Inquiry successfully received', data: { id: reference.id } });
      }
      await adminDb.collection('contacts').add(submission);
    } catch (error) {
      console.error('[Contact persistence]', error);
      return res.status(503).json({ status: 'error', message: 'Contact service is temporarily unavailable' });
    }
  } else {
    CONTACT_SUBMISSIONS.push(submission);
  }

  return res.status(200).json({
    status: 'success',
    message: 'Inquiry successfully received',
    data: { id: submission.id }
  });
});

app.post('/api/v1/public/telemetry/page-view', async (req: Request, res: Response) => {
  const pathValue = typeof req.body?.path === 'string' ? req.body.path.trim() : '';
  if (!pathValue || pathValue.length > 500 || !pathValue.startsWith('/')) {
    return apiError(res, 400, 'INVALID_TELEMETRY', 'A valid path is required.');
  }
  const limit = await enforceRateLimitPolicy('analyticsIngestion', { ip: clientIdentity(req), site: pathValue.match(/^\/@([a-z0-9_-]{3,30})/i)?.[1]?.toLowerCase() || 'unknown' });
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    return apiError(res, 429, 'RATE_LIMITED', 'Too many telemetry events.', { retryAfter: String(limit.retryAfter) });
  }
  if (isAdminConfigured()) {
    const handle = pathValue.match(/^\/@([a-z0-9_-]{3,30})(?:\/|$)/i)?.[1];
    if (handle) {
      const site = await getPublishedSiteByHandle(handle);
      if (site && site.analyticsCollection === false) return res.status(202).json({ status: 'accepted' });
      if (site) {
        const dimensions = analyticsDimensions(req, req.body && typeof req.body === 'object' ? req.body : {});
        const accepted = await persistAnalyticsEvent('page_views', String(site.userId), handle, dimensions, { path: pathValue, siteId: String(site.id || '') });
        return res.status(202).json({ status: 'accepted', deduplicated: !accepted });
      }
      return res.status(202).json({ status: 'accepted' });
    }
  }
  return res.status(202).json({ status: 'accepted' });
});

app.post('/api/v1/public/telemetry/link-click', async (req: Request, res: Response) => {
  const linkId = typeof req.body?.linkId === 'string' ? req.body.linkId.trim() : '';
  const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
  const siteHandle = typeof req.body?.siteHandle === 'string' ? req.body.siteHandle.trim().toLowerCase() : '';
  if (!linkId || linkId.length > 200 || !url || url.length > 2000 || !/^[a-z0-9_-]{3,30}$/.test(siteHandle)) {
    return apiError(res, 400, 'INVALID_TELEMETRY', 'Valid link, URL, and site handle are required.');
  }
  const limit = await enforceRateLimitPolicy('analyticsIngestion', { ip: clientIdentity(req), site: siteHandle || 'unknown' });
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    return apiError(res, 429, 'RATE_LIMITED', 'Too many telemetry events.', { retryAfter: String(limit.retryAfter) });
  }
  if (isAdminConfigured()) {
    const site = await getPublishedSiteByHandle(siteHandle);
    if (!site || site.analyticsCollection === false) return res.status(202).json({ status: 'accepted' });
    const links = Array.isArray(site.links) ? site.links as Array<Record<string, unknown>> : [];
    const socials = Array.isArray(site.socials) ? site.socials as Array<Record<string, unknown>> : [];
    const isSocial = linkId.startsWith('soc_');
    const validTarget = isSocial
      ? socials.some((social) => `soc_${String(social.platform || '')}` === linkId && social.url === url)
      : links.some((link) => link.id === linkId && link.url === url);
    if (!validTarget) return res.status(202).json({ status: 'accepted' });
    const dimensions = analyticsDimensions(req, req.body && typeof req.body === 'object' ? req.body : {});
    const accepted = await persistAnalyticsEvent('link_clicks', String(site.userId), siteHandle, dimensions, { linkId, url, siteId: String(site.id || '') });
    return res.status(202).json({ status: 'accepted', deduplicated: !accepted });
  }
  return res.status(202).json({ status: 'accepted' });
});

/**
 * FR-4.1 User Registration Endpoint (Localhost & Server Auth)
 * Supports localhost registration when Firebase Cloud provider is restricted.
 */
app.post('/api/v1/auth/register', async (req: Request, res: Response) => {
  if (!localAuthEnabled) {
    return res.status(410).json({ status: 'error', message: 'Use Firebase email registration.' });
  }
  const { email, password, handle } = req.body || {};

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ status: 'error', message: 'Email is required' });
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ status: 'error', message: 'Password must be at least 6 characters' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (USERS_DB[normalizedEmail]) {
    return res.status(409).json({ status: 'error', message: 'This email is already registered. Please sign in.' });
  }

  const rawHandle = (handle || normalizedEmail.split('@')[0] || 'creator').toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const cleanHandle = rawHandle.slice(0, 30);
  if (RESERVED_HANDLES.has(cleanHandle)) return res.status(409).json({ status: 'error', message: 'This handle is reserved.' });
  if (isAdminConfigured()) {
    const handleSnapshot = await adminDb.collection('handles').doc(cleanHandle).get();
    if (handleSnapshot.exists) return res.status(409).json({ status: 'error', message: 'This handle is already registered.' });
  }

  const newUserId = `usr_${crypto.randomBytes(8).toString('hex')}`;
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);

  const newUser: UserAccount = {
    id: newUserId,
    email: normalizedEmail,
    passwordHash,
    salt,
    primary_handle: cleanHandle,
    email_verified: false
  };

  const referralCode = parseCookies(req.headers.cookie)['_raloa_ref'];
  qualifyLocalReferral(newUser, referralCode);
  USERS_DB[normalizedEmail] = newUser;
  persistUsersCache();

  const now = Date.now();
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const maxAgeSeconds = 604800; // 7 days (FR-4.1)
  ACTIVE_SESSIONS.set(sessionToken, {
    userId: newUser.id,
    email: newUser.email,
    primary_handle: newUser.primary_handle,
    createdAt: now,
    expiresAt: now + maxAgeSeconds * 1000
  });

  res.setHeader(
    'Set-Cookie',
    `raloa_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`
  );

  return res.status(201).json({
    status: 'success',
    data: {
      user: {
        id: newUser.id,
        email: newUser.email,
        primary_handle: newUser.primary_handle
      },
      redirect_to: '/studio'
    }
  });
});

/**
 * FR-4.1 Credential-Based Authentication (Login)
 * SEC-2 Brute Force Throttling: Max 5 failed attempts per IP + Email per 10 minutes (returns 429).
 * Issues short-lived access / long-lived raloa_session cookie.
 */
app.post('/api/v1/auth/login', async (req: Request, res: Response) => {
  if (!localAuthEnabled) {
    return res.status(410).json({ status: 'error', message: 'Use Firebase email authentication.' });
  }
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const { email, password } = req.body || {};

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ status: 'error', message: 'Email is required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const rateLimitKey = `${ip}:${normalizedEmail}`;
  const now = Date.now();

  // SEC-2 Brute Force Throttling
  const attemptRecord = LOGIN_ATTEMPTS.get(rateLimitKey);
  if (attemptRecord && attemptRecord.lockedUntil > now) {
    const cooldownRemainingSec = Math.ceil((attemptRecord.lockedUntil - now) / 1000);
    res.setHeader('Retry-After', cooldownRemainingSec.toString());
    return res.status(429).json({
      status: 'error',
      error: 'Too Many Requests',
      message: `Account temporarily locked due to consecutive failed attempts. Please try again in ${cooldownRemainingSec} seconds.`,
      retry_after: cooldownRemainingSec
    });
  }

  let user = USERS_DB[normalizedEmail];
  const isLocalhost = req.hostname === 'localhost' || req.hostname === '127.0.0.1';

  // If new user on localhost and password is at least 6 chars, auto-register them seamlessly
  if (!user && isLocalhost && password && password.length >= 6) {
    const salt = DEFAULT_SALT;
    const passwordHash = hashPassword(password, salt);
    const cleanHandle = normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '') || 'creator';
    user = {
      id: `usr_${crypto.randomBytes(8).toString('hex')}`,
      email: normalizedEmail,
      passwordHash,
      salt,
      primary_handle: cleanHandle,
      email_verified: true
    };
    USERS_DB[normalizedEmail] = user;
    persistUsersCache();
  }

  const isValid = Boolean(user && hashPassword(password || '', user.salt) === user.passwordHash);

  if (!isValid) {
    if (!isAdminConfigured()) {
      const currentFailures = (attemptRecord && attemptRecord.lockedUntil <= now && (now - attemptRecord.firstAttemptAt < 600000))
        ? attemptRecord.count + 1
        : 1;
      const lockedUntil = currentFailures >= 5 ? now + 600000 : 0;
      LOGIN_ATTEMPTS.set(rateLimitKey, {
        count: currentFailures,
        lockedUntil,
        firstAttemptAt: attemptRecord?.firstAttemptAt && (now - attemptRecord.firstAttemptAt < 600000) ? attemptRecord.firstAttemptAt : now
      });
      if (lockedUntil > now) {
        const cooldownSec = 600;
        res.setHeader('Retry-After', cooldownSec.toString());
        return res.status(429).json({
          status: 'error',
          error: 'Too Many Requests',
          message: `Account temporarily locked due to consecutive failed attempts. Please try again in ${cooldownSec} seconds.`,
          retry_after: cooldownSec
        });
      }
    } else {
      const distributedLimit = await consumeDistributedRateLimit(`login:${rateLimitKey}`, RATE_LIMIT_POLICIES.authLogin.limit, RATE_LIMIT_POLICIES.authLogin.windowMs);
      if (!distributedLimit.allowed) {
        res.setHeader('Retry-After', distributedLimit.retryAfter.toString());
        return res.status(429).json({ status: 'error', error: 'Too Many Requests', retry_after: distributedLimit.retryAfter });
      }
    }

    return res.status(401).json({
      status: 'error',
      message: 'Invalid email or password.'
    });
  }

  // Credentials valid: clear failed attempts
  LOGIN_ATTEMPTS.delete(rateLimitKey);

  const sessionToken = crypto.randomBytes(32).toString('hex');
  const maxAgeSeconds = 604800; // 7 days (FR-4.1)
  ACTIVE_SESSIONS.set(sessionToken, {
    userId: user.id,
    email: user.email,
    primary_handle: user.primary_handle,
    createdAt: now,
    expiresAt: now + maxAgeSeconds * 1000
  });

  // Set-Cookie header matching FR-4.1 contract
  res.setHeader(
    'Set-Cookie',
    `raloa_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`
  );

  return res.status(200).json({
    status: 'success',
    data: {
      user: {
        id: user.id,
        email: user.email,
        primary_handle: user.primary_handle
      },
      redirect_to: '/studio'
    }
  });
});

/**
 * FR-4.2 Logout Execution Endpoint
 * Invalidates session in memory and purges raloa_session cookie.
 */
app.post('/api/v1/auth/logout', async (req: Request, res: Response) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies['raloa_session'];

  if (sessionToken) {
    if (process.env.NODE_ENV === 'production') {
      const session = await verifySignedSessionCookie(sessionToken);
      if (session?.sessionId && isAdminConfigured()) {
        await adminDb.collection('sessions').doc(session.sessionId).delete();
      }
    } else {
      ACTIVE_SESSIONS.delete(sessionToken);
    }
  }

  res.setHeader(
    'Set-Cookie',
    'raloa_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax'
  );

  return res.status(200).json({
    status: 'success',
    message: 'Session successfully invalidated'
  });
});

/**
 * FR-4.4 Password Reset Request
 * Rate limited to 3 requests per 15 minutes per IP/email.
 * Issues 256-bit token with 15-minute TTL.
 */
app.post('/api/v1/auth/forgot-password', async (req: Request, res: Response) => {
  if (!localAuthEnabled) {
    return res.status(410).json({ status: 'error', message: 'Use Firebase password reset email.' });
  }
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ status: 'error', message: 'Email is required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const rateKey = `${ip}:${normalizedEmail}`;
  const now = Date.now();
  const fifteenMinutesAgo = now - 900000;

  const timestamps = (FORGOT_PW_RATE_LIMITS.get(rateKey) || []).filter((t) => t > fifteenMinutesAgo);
  const distributedLimit = await consumeDistributedRateLimit(`password-reset:${rateKey}`, RATE_LIMIT_POLICIES.authPasswordReset.limit, RATE_LIMIT_POLICIES.authPasswordReset.windowMs);
  if ((!isAdminConfigured() && timestamps.length >= RATE_LIMIT_POLICIES.authPasswordReset.limit) || (isAdminConfigured() && !distributedLimit.allowed)) {
    return res.status(429).json({
      status: 'error',
      error: 'Too Many Requests',
      message: 'Rate limit exceeded: maximum 3 password reset requests per 15 minutes.',
      retry_after: distributedLimit.retryAfter || 900
    });
  }

  if (!isAdminConfigured()) {
    timestamps.push(now);
    FORGOT_PW_RATE_LIMITS.set(rateKey, timestamps);
  }

  const token = crypto.randomBytes(32).toString('hex');
  PASSWORD_RESET_TOKENS.set(token, {
    email: normalizedEmail,
    expiresAt: now + 900000
  });

  return res.status(200).json({
    status: 'success',
    message: 'Password reset link dispatched',
    token
  });
});

/**
 * FR-4.4 Password Reset Confirmation
 * Validates token authenticity before updating password.
 */
app.post('/api/v1/auth/reset-password', (req: Request, res: Response) => {
  if (!localAuthEnabled) {
    return res.status(410).json({ status: 'error', message: 'Use Firebase password reset email.' });
  }
  const { token, new_password, newPassword } = req.body || {};
  const password = new_password || newPassword;

  if (!token || !password) {
    return res.status(400).json({
      status: 'error',
      message: 'Token and new password are required'
    });
  }

  const resetRecord = PASSWORD_RESET_TOKENS.get(token);
  const now = Date.now();
  if (!resetRecord || resetRecord.expiresAt < now) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid or expired password reset token'
    });
  }

  const user = USERS_DB[resetRecord.email];
  if (user) {
    user.passwordHash = hashPassword(password, user.salt);
  } else {
    const handle = resetRecord.email.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '') || 'creator';
    USERS_DB[resetRecord.email] = {
      id: `usr_${Date.now()}`,
      email: resetRecord.email,
      passwordHash: hashPassword(password, DEFAULT_SALT),
      salt: DEFAULT_SALT,
      primary_handle: handle,
      email_verified: true
    };
  }
  persistUsersCache();

  PASSWORD_RESET_TOKENS.delete(token);

  // Invalidate any active sessions for this email upon password change
  for (const [sToken, session] of ACTIVE_SESSIONS.entries()) {
    if (session.email === resetRecord.email) {
      ACTIVE_SESSIONS.delete(sToken);
    }
  }

  return res.status(200).json({
    status: 'success',
    message: 'Password successfully updated'
  });
});

/**
 * FR-4.6 Social Identity Providers (Google)
 */
app.post('/api/v1/auth/oauth/google', (req: Request, res: Response) => {
  if (!localAuthEnabled) {
    return res.status(410).json({ status: 'error', message: 'Use Firebase Google OAuth directly.' });
  }
  const { email } = req.body || {};
  const userEmail = (email || 'google_user@example.com').toLowerCase();
  let user = USERS_DB[userEmail];
  if (!user) {
    user = {
      id: `usr_g_${Date.now()}`,
      email: userEmail,
      passwordHash: '',
      salt: DEFAULT_SALT,
      primary_handle: userEmail.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '') || 'google_creator',
      email_verified: true
    };
    USERS_DB[userEmail] = user;
  }

  const sessionToken = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const maxAgeSeconds = 604800;
  ACTIVE_SESSIONS.set(sessionToken, {
    userId: user.id,
    email: user.email,
    primary_handle: user.primary_handle,
    createdAt: now,
    expiresAt: now + maxAgeSeconds * 1000
  });

  res.setHeader(
    'Set-Cookie',
    `raloa_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`
  );

  return res.status(200).json({
    status: 'success',
    data: {
      user: {
        id: user.id,
        email: user.email,
        primary_handle: user.primary_handle
      },
      redirect_to: '/studio'
    }
  });
});

/**
 * FR-4.6 Social Identity Providers (Sign in with Apple)
 */
app.post('/api/v1/auth/oauth/apple', (req: Request, res: Response) => {
  if (!localAuthEnabled) {
    return res.status(410).json({ status: 'error', message: 'Apple OAuth is not enabled until verified provider credentials are configured.' });
  }
  const { email } = req.body || {};
  const userEmail = (email || 'apple_user@privaterelay.appleid.com').toLowerCase();
  let user = USERS_DB[userEmail];
  if (!user) {
    user = {
      id: `usr_a_${Date.now()}`,
      email: userEmail,
      passwordHash: '',
      salt: DEFAULT_SALT,
      primary_handle: userEmail.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '') || 'apple_creator',
      email_verified: true
    };
    USERS_DB[userEmail] = user;
  }

  const sessionToken = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const maxAgeSeconds = 604800;
  ACTIVE_SESSIONS.set(sessionToken, {
    userId: user.id,
    email: user.email,
    primary_handle: user.primary_handle,
    createdAt: now,
    expiresAt: now + maxAgeSeconds * 1000
  });

  res.setHeader(
    'Set-Cookie',
    `raloa_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`
  );

  return res.status(200).json({
    status: 'success',
    data: {
      user: {
        id: user.id,
        email: user.email,
        primary_handle: user.primary_handle
      },
      redirect_to: '/studio'
    }
  });
});

/**
 * Current Session Check
 */
app.get('/api/v1/auth/session', (req: Request, res: Response) => {
  getAuthenticatedUser(req).then((session) => {
    if (!session) return res.status(401).json({ status: 'error', message: 'Not authenticated' });
    return res.status(200).json({
    status: 'success',
    data: {
      user: {
        id: session.uid,
        email: session.email,
        primary_handle: 'primary_handle' in session ? session.primary_handle : session.email?.split('@')[0] || 'creator'
      }
    }
    });
  }).catch(() => res.status(401).json({ status: 'error', message: 'Not authenticated' }));
});

app.post('/api/v1/auth/session', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ status: 'error', message: 'Invalid Firebase session' });
  if (process.env.NODE_ENV === 'production') {
    const profile = isAdminConfigured() ? await adminDb.collection('users').doc(user.uid).get() : null;
    const primaryHandle = String(profile?.data()?.handle || user.email?.split('@')[0] || 'creator');
    const cookie = await createSignedSessionCookie(user, primaryHandle);
    res.setHeader('Set-Cookie', `raloa_session=${cookie}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`);
    return res.status(200).json({ status: 'success' });
  }
  const now = Date.now();
  const sessionToken = crypto.randomBytes(32).toString('hex');
  ACTIVE_SESSIONS.set(sessionToken, {
    userId: user.uid,
    email: user.email || '',
    primary_handle: user.email?.split('@')[0] || 'creator',
    createdAt: now,
    expiresAt: now + 604800000
  });
  res.setHeader('Set-Cookie', `raloa_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`);
  return res.status(200).json({ status: 'success' });
});

/**
 * Multi-session management & Revoke-All
 */
app.get('/api/account/sessions', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');

  const cookies = parseCookies(req.headers.cookie);
  const currentSessionToken = cookies['raloa_session'];
  const userSessions: Array<{ id: string; current: boolean; createdAt: string; userAgent: string; ip: string }> = [];

  if (process.env.NODE_ENV === 'production' && isAdminConfigured()) {
    const snapshot = await adminDb.collection('sessions').where('userId', '==', user.uid).limit(50).get();
    for (const document of snapshot.docs) {
      const data = document.data();
      if (Date.parse(String(data.expiresAt || '')) <= Date.now()) continue;
      userSessions.push({
        id: document.id,
        current: document.id === (await verifySignedSessionCookie(currentSessionToken || ''))?.sessionId,
        createdAt: String(data.createdAt || new Date().toISOString()),
        userAgent: String(data.userAgent || 'Browser Session'),
        ip: String(data.ip || 'Unknown')
      });
    }
  } else {
    for (const [token, session] of ACTIVE_SESSIONS.entries()) {
      if (session.userId === user.uid || session.email === user.email) {
        userSessions.push({
          id: token,
          current: token === currentSessionToken,
          createdAt: new Date(session.createdAt).toISOString(),
          userAgent: String(req.headers['user-agent'] || 'Browser Session'),
          ip: String(req.ip || '127.0.0.1')
        });
      }
    }
  }

  // Ensure current session is represented
  if (userSessions.length === 0) {
    userSessions.push({
      id: 'current',
      current: true,
      createdAt: new Date().toISOString(),
      userAgent: String(req.headers['user-agent'] || 'Current Browser'),
      ip: String(req.ip || '127.0.0.1')
    });
  }

  return res.status(200).json({ sessions: userSessions });
});

app.delete('/api/account/sessions/:sessionId', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');

  const { sessionId } = req.params;
  if (process.env.NODE_ENV === 'production' && isAdminConfigured()) {
    const sessionRef = adminDb.collection('sessions').doc(sessionId);
    const snapshot = await sessionRef.get();
    if (snapshot.exists && snapshot.data()?.userId === user.uid) await sessionRef.delete();
  } else {
    for (const [token, session] of ACTIVE_SESSIONS.entries()) {
      if ((session.userId === user.uid || session.email === user.email) && token === sessionId) {
        ACTIVE_SESSIONS.delete(token);
      }
    }
  }
  return res.status(200).json({ status: 'revoked' });
});

app.post('/api/account/sessions/revoke-all', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');

  if (process.env.NODE_ENV === 'production' && isAdminConfigured()) {
    const snapshot = await adminDb.collection('sessions').where('userId', '==', user.uid).limit(100).get();
    const batch = adminDb.batch();
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
  } else {
    for (const [token, session] of ACTIVE_SESSIONS.entries()) {
      if (session.userId === user.uid || session.email === user.email) {
        ACTIVE_SESSIONS.delete(token);
      }
    }
  }

  // Revoke Firebase Auth refresh tokens if admin is configured
  if (isAdminConfigured()) {
    try {
      await adminAuth.revokeRefreshTokens(user.uid);
    } catch (err) {
      console.warn('Could not revoke Firebase refresh tokens:', err);
    }
  }

  // Clear cookie on caller's browser
  res.setHeader(
    'Set-Cookie',
    'raloa_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax'
  );

  return res.status(200).json({ status: 'all_revoked', message: 'Signed out of all devices.' });
});

/**
 * FR-4.5 Email Verification Confirmation
 */
app.post('/api/v1/auth/verify-email', (req: Request, res: Response) => {
  if (!localAuthEnabled) {
    return res.status(410).json({ status: 'error', message: 'Use Firebase email verification.' });
  }
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ status: 'error', message: 'Email is required' });
  }

  const user = USERS_DB[email.trim().toLowerCase()];
  if (user) {
    user.email_verified = true;
  }

  return res.status(200).json({
    status: 'success',
    message: 'Email successfully verified'
  });
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', service: 'raloa', timestamp: new Date().toISOString() });
});

app.get('/api/readiness', async (_req: Request, res: Response) => {
  if (process.env.NODE_ENV !== 'production') {
    return res.status(200).json({ status: 'ready', environment: 'development' });
  }

  const checks: Record<string, boolean> = {
    firebaseAdmin: isAdminConfigured(),
    stripe: isStripeConfigured()
      && Boolean(getPriceId('pro', false))
      && Boolean(getPriceId('pro', true))
      && Boolean(getPriceId('studio', false))
      && Boolean(getPriceId('studio', true)),
    stripeWebhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    appUrl: /^https:\/\//.test(process.env.APP_URL || ''),
    authSessionSecret: AUTH_SESSION_SECRET.length >= 32,
    cloudflare: Boolean(getCloudflareConfig())
  };

  if (checks.firebaseAdmin) {
    try {
      await adminDb.collection('users').limit(1).get();
    } catch {
      checks.firebaseAdmin = false;
    }
  }

  const ready = Object.values(checks).every(Boolean);
  return res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', checks });
});

function accountSettingsFor(user: AuthenticatedUser): Record<string, unknown> {
  const existing = LOCAL_ACCOUNT_SETTINGS.get(user.uid);
  if (existing) return existing;
  const localUser = Object.values(USERS_DB).find((candidate) => candidate.id === user.uid || candidate.email === user.email);
  const initial = {
    uid: user.uid,
    email: user.email || localUser?.email || null,
    emailVerified: Boolean(localUser?.email_verified),
    displayName: localUser?.primary_handle || user.email?.split('@')[0] || 'Creator',
    handle: localUser?.primary_handle || user.email?.split('@')[0] || 'creator',
    photoURL: null,
    bio: '',
    pronouns: '',
    location: '',
    website: '',
    locale: 'en',
    timeZone: 'Asia/Riyadh',
    notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
    notificationChannels: DEFAULT_NOTIFICATION_CHANNELS,
    privacyPreferences: DEFAULT_PRIVACY_PREFERENCES,
    plan: 'free',
    billingStatus: 'free',
    referralsCount: 0,
    referralRewards: { verifiedBadgeUnlocked: false, freeProMonthsEarned: 0, customDomainUnlocked: false },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  LOCAL_ACCOUNT_SETTINGS.set(user.uid, initial);
  return initial;
}

async function accountDocument(user: AuthenticatedUser) {
  if (!isAdminConfigured()) return null;
  return adminDb.collection('users').doc(user.uid);
}

app.get('/api/account/profile', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  try {
    const ref = await accountDocument(user);
    if (!ref) return res.status(200).json({ profile: accountSettingsFor(user) });
    const snapshot = await ref.get();
    const profile = { ...accountSettingsFor(user), ...(snapshot.exists ? snapshot.data() : {}) };
    return res.status(200).json({ profile });
  } catch (error) {
    console.error('[Account profile read]', error);
    return apiError(res, 503, 'PROFILE_UNAVAILABLE', 'Your profile is temporarily unavailable.');
  }
});

app.put('/api/account/profile', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  const body = req.body || {};
  const textFields = ['displayName', 'bio', 'pronouns', 'location', 'website', 'timeZone'] as const;
  const updates: Record<string, unknown> = {};
  for (const field of textFields) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== 'string') return apiError(res, 400, 'INVALID_FIELD', `${field} must be text.`, { [field]: 'Enter valid text.' });
      updates[field] = body[field].trim();
    }
  }
  if (typeof body.locale !== 'undefined' && body.locale !== 'en' && body.locale !== 'ar') {
    return apiError(res, 400, 'INVALID_LOCALE', 'Choose English or Arabic.', { locale: 'Choose a supported language.' });
  }
  if (body.locale) updates.locale = body.locale;
  if (body.photoURL !== undefined) {
    if (typeof body.photoURL !== 'string' || body.photoURL.length > 2000 || (body.photoURL && !/^https:\/\//i.test(body.photoURL))) {
      return apiError(res, 400, 'INVALID_AVATAR', 'Avatar URL must be an HTTPS URL.', { photoURL: 'Use a valid HTTPS image URL.' });
    }
    updates.photoURL = body.photoURL;
  }
  if (typeof updates.displayName === 'string' && (!updates.displayName || updates.displayName.length > 80)) return apiError(res, 400, 'INVALID_DISPLAY_NAME', 'Display name must be 1–80 characters.', { displayName: 'Use 1–80 characters.' });
  if (typeof updates.bio === 'string' && updates.bio.length > 500) return apiError(res, 400, 'INVALID_BIO', 'Bio must be 500 characters or fewer.', { bio: 'Use 500 characters or fewer.' });
  if (typeof updates.pronouns === 'string' && updates.pronouns.length > 60) return apiError(res, 400, 'INVALID_PRONOUNS', 'Pronouns must be 60 characters or fewer.', { pronouns: 'Use 60 characters or fewer.' });
  if (typeof updates.location === 'string' && updates.location.length > 100) return apiError(res, 400, 'INVALID_LOCATION', 'Location must be 100 characters or fewer.', { location: 'Use 100 characters or fewer.' });
  if (typeof updates.website === 'string' && updates.website && !/^https:\/\//i.test(updates.website)) return apiError(res, 400, 'INVALID_WEBSITE', 'Website must use HTTPS.', { website: 'Use an https:// URL.' });
  if (typeof updates.website === 'string' && updates.website.length > 500) return apiError(res, 400, 'INVALID_WEBSITE', 'Website URL is too long.', { website: 'Use 500 characters or fewer.' });
  if (typeof updates.timeZone === 'string' && updates.timeZone.length > 80) return apiError(res, 400, 'INVALID_TIME_ZONE', 'Time zone is invalid.', { timeZone: 'Choose a valid time zone.' });
  updates.updatedAt = new Date().toISOString();
  try {
    const ref = await accountDocument(user);
    if (ref) {
      await ref.set(updates, { merge: true });
    }
    const local = { ...accountSettingsFor(user), ...updates };
    LOCAL_ACCOUNT_SETTINGS.set(user.uid, local);
    return res.status(200).json({ profile: local });
  } catch (error) {
    console.error('[Account profile write]', error);
    return apiError(res, 503, 'PROFILE_SAVE_FAILED', 'Your profile could not be saved.');
  }
});

app.get('/api/account/preferences', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  try {
    const ref = await accountDocument(user);
    const snapshot = ref ? await ref.get() : null;
    const data = snapshot?.data() || accountSettingsFor(user);
    return res.status(200).json({
      notifications: { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(data.notificationPreferences as Record<string, boolean> || {}) },
      privacy: { ...DEFAULT_PRIVACY_PREFERENCES, ...(data.privacyPreferences as Record<string, boolean> || {}) },
      channels: { ...DEFAULT_NOTIFICATION_CHANNELS, ...(data.notificationChannels as Record<string, boolean> || {}) }
    });
  } catch (error) {
    console.error('[Account preferences read]', error);
    return apiError(res, 503, 'PREFERENCES_UNAVAILABLE', 'Preferences are temporarily unavailable.');
  }
});

app.put('/api/account/preferences', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  const validatePreferences = (value: unknown, allowed: Record<string, boolean>) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const incoming = value as Record<string, unknown>;
    if (Object.keys(incoming).some((key) => !(key in allowed) || typeof incoming[key] !== 'boolean')) return null;
    return { ...allowed, ...incoming };
  };
  const notifications = validatePreferences(req.body?.notifications, DEFAULT_NOTIFICATION_PREFERENCES);
  const privacy = validatePreferences(req.body?.privacy, DEFAULT_PRIVACY_PREFERENCES);
  const channels = validatePreferences(req.body?.channels, DEFAULT_NOTIFICATION_CHANNELS);
  if (!notifications || !privacy || !channels) return apiError(res, 400, 'INVALID_PREFERENCES', 'Preference values must be supported boolean settings.');
  try {
    const updates = { notificationPreferences: notifications, privacyPreferences: privacy, notificationChannels: channels, updatedAt: new Date().toISOString() };
    const ref = await accountDocument(user);
    if (ref) await ref.set(updates, { merge: true });
    LOCAL_ACCOUNT_SETTINGS.set(user.uid, { ...accountSettingsFor(user), ...updates });
    return res.status(200).json({ notifications, privacy, channels });
  } catch (error) {
    console.error('[Account preferences write]', error);
    return apiError(res, 503, 'PREFERENCES_SAVE_FAILED', 'Preferences could not be saved.');
  }
});

app.get('/api/account/billing', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  if (process.env.NODE_ENV === 'production' && !stripe) return apiError(res, 503, 'BILLING_NOT_CONFIGURED', 'Live billing is not configured.');
  try {
    const snapshot = await entitlementService.resolve(user.uid);
    return res.status(200).json({ billing: { ...snapshot.billing, entitlements: snapshot.entitlements, evaluatedAt: snapshot.evaluatedAt } });
  } catch (error) {
    console.error('[Account billing read]', error);
    return apiError(res, 503, 'BILLING_STATUS_UNAVAILABLE', 'Billing status is temporarily unavailable.');
  }
});

app.get('/api/account/billing/details', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  try {
    const details = isAdminConfigured() ? await getBillingDetails(user.uid) : { invoices: [], paymentMethod: null };
    return res.status(200).json(details);
  } catch (error) {
    console.error('[Account billing details]', error);
    return apiError(res, 503, 'BILLING_DETAILS_UNAVAILABLE', 'Billing details are temporarily unavailable.');
  }
});

app.get('/api/account/referrals', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  try {
    const ref = await accountDocument(user);
    const snapshot = ref ? await ref.get() : null;
    const data = snapshot?.data() || accountSettingsFor(user);
    const code = String(data.handle || 'creator').toLowerCase();
    const referrals = ref ? await ref.collection('referrals').limit(100).get() : null;
    return res.status(200).json({ summary: {
      referralLink: `${APP_URL}/join?ref=${encodeURIComponent(code)}`,
      qualifiedCount: Number(data.referralsCount || 0),
      pendingCount: referrals ? referrals.docs.filter((doc) => doc.data().status === 'invited').length : 0,
      rewards: data.referralRewards || {},
      rewardExpiresAt: data.referralProUntil || null
    }, invitations: referrals ? referrals.docs.map((doc) => ({ id: doc.id, email: doc.data().invitedEmail || null, status: doc.data().status || 'invited', createdAt: doc.data().createdAt || null })).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 20) : [] });
  } catch (error) {
    console.error('[Account referrals read]', error);
    return apiError(res, 503, 'REFERRALS_UNAVAILABLE', 'Referral rewards are temporarily unavailable.');
  }
});

app.post('/api/account/delete-request', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  try {
    const ref = await accountDocument(user);
    if (ref) {
      const profile = await ref.get();
      const billingStatus = profile.data()?.billingStatus;
      if (['active', 'trialing', 'past_due', 'incomplete'].includes(String(billingStatus))) {
        return apiError(res, 409, 'ACTIVE_BILLING', 'Cancel your active subscription before requesting account deletion.');
      }
      const requestRef = adminDb.collection('account_deletion_requests').doc(user.uid);
      await requestRef.set({ uid: user.uid, email: user.email || null, status: 'requested', requestedAt: new Date().toISOString() }, { merge: true });
    } else {
      LOCAL_ACCOUNT_SETTINGS.set(user.uid, { ...accountSettingsFor(user), deletionRequestedAt: new Date().toISOString() });
    }
    return res.status(202).json({ status: 'requested' });
  } catch (error) {
    console.error('[Account deletion request]', error);
    return apiError(res, 503, 'DELETE_REQUEST_FAILED', 'The deletion request could not be recorded.');
  }
});

app.get('/api/account/export', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  try {
    const ref = await accountDocument(user);
    const profile = ref ? (await ref.get()).data() || {} : accountSettingsFor(user);
    const sites = ref ? (await ref.collection('sites').limit(100).get()).docs.map((document) => ({ id: document.id, ...document.data() })) : [];
    const referrals = ref ? (await ref.collection('referrals').limit(1000).get()).docs.map((doc) => doc.data()) : [];
    const exportData = {
      exportedAt: new Date().toISOString(),
      account: { uid: user.uid, email: user.email || profile.email || null, profile: { ...profile, stripeCustomerId: undefined, stripeSubscriptionId: undefined } },
      sites,
      referrals
    };
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="raloa-account-export-${user.uid}.json"`);
    return res.status(200).send(JSON.stringify(exportData, null, 2));
  } catch (error) {
    console.error('[Account export]', error);
    return apiError(res, 503, 'EXPORT_FAILED', 'Your data export could not be generated.');
  }
});

async function analyticsFromRollups(userId: string, sites: Array<QueryDocumentSnapshot>, requestedSiteId: string, fromDate: string | null, toDate: string): Promise<Record<string, unknown> | null> {
  let rollupQuery: Query = adminDb.collection('analytics_rollups').where('siteOwnerId', '==', userId).where('date', '<=', toDate);
  if (fromDate) rollupQuery = rollupQuery.where('date', '>=', fromDate);
  if (requestedSiteId) rollupQuery = rollupQuery.where('siteId', '==', requestedSiteId);
  const rollups = await rollupQuery.get();
  if (rollups.empty) return null;
  let visitorQuery: Query = adminDb.collection('analytics_visitor_days').where('siteOwnerId', '==', userId).where('date', '<=', toDate);
  if (fromDate) visitorQuery = visitorQuery.where('date', '>=', fromDate);
  if (requestedSiteId) visitorQuery = visitorQuery.where('siteId', '==', requestedSiteId);
  const visitors = await visitorQuery.get();
  const activeSites = requestedSiteId ? sites.filter((site) => site.id === requestedSiteId) : sites;
  const siteLinks = new Map<string, { title: string; url: string; blockType: string }>();
  activeSites.forEach((site) => {
    const links = Array.isArray(site.data().links) ? site.data().links : [];
    links.forEach((link: any) => {
      if (typeof link?.id === 'string') siteLinks.set(link.id, { title: String(link.title || link.id), url: String(link.url || ''), blockType: String(link.type || 'link') });
    });
  });
  const timeline = new Map<string, { date: string; views: number; clicks: number; uniqueVisitors: number }>();
  const linkCounts = new Map<string, { linkId: string; title: string; url: string; blockType: string; clicks: number }>();
  const utmCounts = new Map<string, { source: string; medium: string; campaign: string; views: number; clicks: number; uniqueVisitors: number }>();
  const dimensions = { referrers: new Map<string, number>(), devices: new Map<string, number>(), browsers: new Map<string, number>(), countries: new Map<string, number>() };
  let totalPageViews = 0;
  let totalClicks = 0;
  const visitorIds = new Set<string>();
  visitors.docs.forEach((document) => visitorIds.add(String(document.data()?.visitorIdHash || document.id)));
  let rollupFreshThrough: string | null = null;
  rollups.docs.forEach((document) => {
    const data = document.data();
    const date = String(data.date || '');
    if (data.updatedAt && (!rollupFreshThrough || String(data.updatedAt) > rollupFreshThrough)) rollupFreshThrough = String(data.updatedAt);
    if (data.kind === 'summary') {
      const views = Number(data.pageViews || 0);
      const clicks = Number(data.linkClicks || 0);
      totalPageViews += views;
      totalClicks += clicks;
      const day = timeline.get(date) || { date, views: 0, clicks: 0, uniqueVisitors: 0 };
      day.views += views;
      day.clicks += clicks;
      timeline.set(date, day);
    } else if (data.kind === 'link') {
      const linkId = String(data.linkId || 'unknown');
      const link = linkCounts.get(linkId) || { linkId, title: siteLinks.get(linkId)?.title || linkId, url: siteLinks.get(linkId)?.url || '', blockType: siteLinks.get(linkId)?.blockType || (linkId.startsWith('soc_') ? 'social' : 'link'), clicks: 0 };
      link.clicks += Number(data.clicks || 0);
      linkCounts.set(linkId, link);
    } else if (data.kind === 'dimension') {
      const map = data.dimension === 'referrer' ? dimensions.referrers : data.dimension === 'device' ? dimensions.devices : data.dimension === 'browser' ? dimensions.browsers : dimensions.countries;
      map.set(String(data.key || 'unknown'), (map.get(String(data.key || 'unknown')) || 0) + Number(data.views || 0));
    } else if (data.kind === 'utm') {
      const key = `${data.source}\u0000${data.medium}\u0000${data.campaign}`;
      const item = utmCounts.get(key) || { source: String(data.source || '(direct)'), medium: String(data.medium || '(none)'), campaign: String(data.campaign || '(none)'), views: 0, clicks: 0, uniqueVisitors: 0 };
      item.views += Number(data.views || 0);
      item.clicks += Number(data.clicks || 0);
      utmCounts.set(key, item);
    }
  });
  visitors.docs.forEach((document) => {
    const data = document.data();
    const day = String(data.date || '');
    const current = timeline.get(day);
    if (current) current.uniqueVisitors += 1;
  });
  const toBreakdown = (map: Map<string, number>) => [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 20);
  return {
    totalVisits: totalPageViews,
    totalPageViews,
    uniqueVisitors: visitorIds.size,
    totalClicks,
    ctr: totalPageViews ? Number(((totalClicks / totalPageViews) * 100).toFixed(2)) : null,
    activeSitesCount: activeSites.length,
    dateRange: { from: fromDate, to: toDate },
    capped: false,
    truncated: false,
    dataSource: 'daily_rollups',
    rollupFreshThrough,
    timeline: [...timeline.values()].sort((a, b) => a.date.localeCompare(b.date)),
    links: [...linkCounts.values()].sort((a, b) => b.clicks - a.clicks).map((link) => ({ ...link, share: totalClicks ? Number(((link.clicks / totalClicks) * 100).toFixed(1)) : 0 })),
    utmSources: [...utmCounts.values()].sort((a, b) => (b.clicks + b.views) - (a.clicks + a.views)),
    referrers: toBreakdown(dimensions.referrers),
    devices: toBreakdown(dimensions.devices),
    browsers: toBreakdown(dimensions.browsers),
    countries: toBreakdown(dimensions.countries)
  };
}

async function readAnalyticsEvents(collection: 'page_views' | 'link_clicks', userId: string, maxEvents = 10000, fromTimestamp?: string, toTimestamp?: string): Promise<{ events: QueryDocumentSnapshot[]; capped: boolean }> {
  const events: QueryDocumentSnapshot[] = [];
  let query: Query = adminDb.collection(collection).where('siteOwnerId', '==', userId);
  if (fromTimestamp) query = query.where('timestamp', '>=', fromTimestamp);
  if (toTimestamp) query = query.where('timestamp', '<', toTimestamp);
  query = query.orderBy('timestamp', 'asc').limit(1000);
  while (true) {
    const page = await query.get();
    const remaining = Math.max(0, maxEvents - events.length);
    events.push(...page.docs.slice(0, remaining));
    if (page.docs.length < 1000) return { events, capped: false };
    if (events.length >= maxEvents) return { events, capped: true };
    query = query.startAfter(page.docs[page.docs.length - 1]);
  }
}

app.get('/api/analytics/platform', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  if (!isAdminConfigured()) return apiError(res, 503, 'ANALYTICS_UNAVAILABLE', 'Platform analytics are temporarily unavailable.');
  try {
    await entitlementService.assertEntitled(user.uid, 'analytics');
  } catch {
    return entitlementError(res, 'analytics', 'Analytics require a Pro or Studio plan.');
  }
  try {
    const requestedFrom = typeof req.query.from === 'string' ? req.query.from : '';
    const requestedTo = typeof req.query.to === 'string' ? req.query.to : '';
    const validDate = (value: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const parsed = new Date(`${value}T00:00:00.000Z`);
      return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    };
    const range = req.query.days === '7' ? 7 : req.query.days === 'all' ? null : 30;
    const toDate = validDate(requestedTo) ? requestedTo : new Date().toISOString().slice(0, 10);
    const defaultFrom = range === null ? null : new Date(Date.parse(`${toDate}T00:00:00.000Z`) - ((range || 30) - 1) * 86400000).toISOString().slice(0, 10);
    const fromDate = validDate(requestedFrom) ? requestedFrom : defaultFrom;
    if ((requestedFrom && !validDate(requestedFrom)) || (requestedTo && !validDate(requestedTo)) || (fromDate && fromDate > toDate)) return apiError(res, 400, 'INVALID_ANALYTICS_RANGE', 'Use a valid inclusive from/to date range.');
    const cutoff = fromDate ? Date.parse(`${fromDate}T00:00:00.000Z`) : 0;
    const endExclusive = Date.parse(`${toDate}T00:00:00.000Z`) + 86400000;
    const requestedSiteId = typeof req.query.siteId === 'string' ? req.query.siteId.trim() : '';
    const sitesSnapshot = await adminDb.collection('users').doc(user.uid).collection('sites').get();
    const selectedSite = requestedSiteId ? sitesSnapshot.docs.find((document) => document.id === requestedSiteId) : null;
    if (requestedSiteId && !(await getOwnedSite(user.uid, requestedSiteId))) return apiError(res, 404, 'SITE_NOT_FOUND', 'The requested site was not found for this account.');
    const rollupMetrics = await analyticsFromRollups(user.uid, sitesSnapshot.docs, requestedSiteId, fromDate, toDate);
    if (rollupMetrics) return res.status(200).json(rollupMetrics);
    const [viewsResult, clicksResult] = await Promise.all([
      readAnalyticsEvents('page_views', user.uid, 10000, new Date(cutoff).toISOString(), new Date(endExclusive).toISOString()),
      readAnalyticsEvents('link_clicks', user.uid, 10000, new Date(cutoff).toISOString(), new Date(endExclusive).toISOString())
    ]);
    const viewsSnapshot = viewsResult.events;
    const clicksSnapshot = clicksResult.events;
    const rawEventsCapped = viewsResult.capped || clicksResult.capped;
    const views = viewsSnapshot.filter((document) => !requestedSiteId || String(document.data()?.siteId || '') === requestedSiteId);
    const clicks = clicksSnapshot.filter((document) => !requestedSiteId || String(document.data()?.siteId || '') === requestedSiteId);
    const sites = selectedSite ? [selectedSite] : sitesSnapshot.docs;
    const siteLinks = new Map<string, { title: string; url: string; blockType: string }>();
    sites.forEach((siteDocument) => {
      const links = Array.isArray(siteDocument.data().links) ? siteDocument.data().links : [];
      links.forEach((link: any) => {
        if (typeof link?.id === 'string') siteLinks.set(link.id, { title: String(link.title || link.id), url: String(link.url || ''), blockType: String(link.type || 'link') });
      });
    });
    const timeline = new Map<string, { date: string; views: number; clicks: number; visitors: Set<string> }>();
    const uniqueVisitors = new Set<string>();
    const linkCounts = new Map<string, { linkId: string; title: string; url: string; blockType: string; clicks: number }>();
    const utmCounts = new Map<string, { source: string; medium: string; campaign: string; views: number; clicks: number; visitors: Set<string> }>();
    const dimensionCounts = {
      referrers: new Map<string, number>(),
      devices: new Map<string, number>(),
      browsers: new Map<string, number>(),
      countries: new Map<string, number>()
    };
    const eventTimestamp = (data: Record<string, any>) => {
      if (typeof data.timestamp === 'string') return Date.parse(data.timestamp);
      if (data.timestamp && typeof data.timestamp.toDate === 'function') return data.timestamp.toDate().getTime();
      return Number(data.timestamp || 0);
    };
    const inRange = (timestamp: number) => Number.isFinite(timestamp) && timestamp >= cutoff && timestamp < endExclusive;
    const increment = (map: Map<string, number>, key: string | null) => { if (key) map.set(key, (map.get(key) || 0) + 1); };
    const addUtm = (data: Record<string, any>, type: 'views' | 'clicks') => {
      const source = String(data.utmSource || '(direct)');
      const medium = String(data.utmMedium || '(none)');
      const campaign = String(data.utmCampaign || '(none)');
      const key = `${source}\u0000${medium}\u0000${campaign}`;
      const current = utmCounts.get(key) || { source, medium, campaign, views: 0, clicks: 0, visitors: new Set<string>() };
      current[type] += 1;
      if (data.visitorIdHash) current.visitors.add(String(data.visitorIdHash));
      utmCounts.set(key, current);
    };
    for (const document of views) {
      const data = document.data() as Record<string, any>;
      const timestamp = eventTimestamp(data);
      if (!inRange(timestamp)) continue;
      const date = new Date(timestamp).toISOString().slice(0, 10);
      const current = timeline.get(date) || { date, views: 0, clicks: 0, visitors: new Set<string>() };
      current.views += 1;
      const visitor = String(data.visitorIdHash || document.id);
      current.visitors.add(visitor);
      uniqueVisitors.add(visitor);
      increment(dimensionCounts.referrers, data.referrerHost ? String(data.referrerHost) : '(direct)');
      increment(dimensionCounts.devices, String(data.device || 'unknown'));
      increment(dimensionCounts.browsers, String(data.browser || 'Unknown'));
      increment(dimensionCounts.countries, data.country ? String(data.country) : '(unknown)');
      addUtm(data, 'views');
      timeline.set(date, current);
    }
    for (const document of clicks) {
      const data = document.data() as Record<string, any>;
      const timestamp = eventTimestamp(data);
      if (!inRange(timestamp)) continue;
      const date = new Date(timestamp).toISOString().slice(0, 10);
      const current = timeline.get(date) || { date, views: 0, clicks: 0, visitors: new Set<string>() };
      current.clicks += 1;
      const linkId = String(data.linkId || 'unknown');
      const link = linkCounts.get(linkId) || { linkId, title: siteLinks.get(linkId)?.title || linkId, url: siteLinks.get(linkId)?.url || String(data.url || ''), blockType: siteLinks.get(linkId)?.blockType || (linkId.startsWith('soc_') ? 'social' : 'link'), clicks: 0 };
      link.clicks += 1;
      linkCounts.set(linkId, link);
      addUtm(data, 'clicks');
      timeline.set(date, current);
    }
    const timelineData = [...timeline.values()].sort((a, b) => a.date.localeCompare(b.date)).map((day) => ({ date: day.date, views: day.views, clicks: day.clicks, uniqueVisitors: day.visitors.size }));
    const totalPageViews = timelineData.reduce((total, day) => total + day.views, 0);
    const totalClicks = timelineData.reduce((total, day) => total + day.clicks, 0);
    const toBreakdown = (map: Map<string, number>) => [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 20);
    return res.status(200).json({
      totalVisits: totalPageViews,
      totalPageViews,
      uniqueVisitors: uniqueVisitors.size,
      totalClicks,
      ctr: totalPageViews ? Number(((totalClicks / totalPageViews) * 100).toFixed(2)) : null,
      activeSitesCount: sites.length,
      dateRange: { from: fromDate, to: toDate },
      capped: rawEventsCapped,
      truncated: rawEventsCapped,
      dataSource: 'legacy_events',
      timeline: timelineData,
      links: [...linkCounts.values()].sort((a, b) => b.clicks - a.clicks).map((link) => ({ ...link, share: totalClicks ? Number(((link.clicks / totalClicks) * 100).toFixed(1)) : 0 })),
      utmSources: [...utmCounts.values()].sort((a, b) => (b.clicks + b.views) - (a.clicks + a.views)).map((item) => ({ source: item.source, medium: item.medium, campaign: item.campaign, views: item.views, clicks: item.clicks, uniqueVisitors: item.visitors.size })),
      referrers: toBreakdown(dimensionCounts.referrers),
      devices: toBreakdown(dimensionCounts.devices),
      browsers: toBreakdown(dimensionCounts.browsers),
      countries: toBreakdown(dimensionCounts.countries)
    });
  } catch (error) {
    console.error('[Platform analytics]', error);
    return apiError(res, 503, 'ANALYTICS_UNAVAILABLE', 'Platform analytics are temporarily unavailable.');
  }
});

app.post('/api/media/upload', authenticateMediaUpload, parseMediaUpload, async (req: Request, res: Response) => {
  const user = (req as Request & { mediaUser?: AuthenticatedUser }).mediaUser;
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  if (!isAdminConfigured()) return apiError(res, 503, 'MEDIA_UNAVAILABLE', 'Media storage is not configured.');
  const file = (req as Request & { file?: Express.Multer.File }).file;
  const siteId = typeof req.body?.siteId === 'string' ? req.body.siteId.trim() : '';
  const purpose = typeof req.body?.purpose === 'string' ? req.body.purpose.trim().toLowerCase() : '';
  if (!siteId) return apiError(res, 400, 'SITE_ID_REQUIRED', 'A site ID is required.');
  const mediaRate = await enforceRateLimitPolicy('mediaUploads', { ip: clientIdentity(req), user: user.uid, site: siteId });
  if (!mediaRate.allowed) return res.status(429).set('Retry-After', String(mediaRate.retryAfter)).json({ error: 'Too many media uploads', retry_after: mediaRate.retryAfter });
  if (!MEDIA_PURPOSES.has(purpose)) return apiError(res, 400, 'INVALID_MEDIA_PURPOSE', 'The media purpose is not supported.');
  if (!file?.buffer?.length) return apiError(res, 400, 'MEDIA_FILE_REQUIRED', 'Choose an image to upload.');
  if (!MEDIA_MIME_TYPES.has(file.mimetype)) return apiError(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Only JPEG, PNG, and WebP images are supported.');
  try {
    const siteRef = adminDb.collection('users').doc(user.uid).collection('sites').doc(siteId);
    const siteSnapshot = await siteRef.get();
    if (!siteSnapshot.exists) return apiError(res, 404, 'SITE_NOT_FOUND', 'Site not found.');
    const entitlementSnapshot = await entitlementService.resolve(user.uid);
    if (entitlementSnapshot.entitlements.maxUploadBytes < file.size) return entitlementError(res, 'mediaUpload', `Your current plan allows uploads up to ${Math.round(entitlementSnapshot.entitlements.maxUploadBytes / (1024 * 1024))} MB.`);
    await cleanupOrphanMedia(user.uid, siteId);
    const mediaSnapshot = await adminDb.collection('media_assets').where('userId', '==', user.uid).where('siteId', '==', siteId).where('status', '==', 'ready').limit(10001).get();
    const currentAssetCount = mediaSnapshot.size + countExternalMedia(siteSnapshot.data() || {});
    if (entitlementSnapshot.entitlements.maxMedia !== null && currentAssetCount >= entitlementSnapshot.entitlements.maxMedia) {
      return entitlementError(res, 'media', `Your current plan allows up to ${entitlementSnapshot.entitlements.maxMedia} media assets.`);
    }
    const metadata = await sharp(file.buffer).metadata();
    if (!metadata.width || !metadata.height || metadata.width < 1 || metadata.height < 1 || metadata.width > MAX_MEDIA_DIMENSION || metadata.height > MAX_MEDIA_DIMENSION) {
      return apiError(res, 422, 'INVALID_MEDIA_DIMENSIONS', `Images must be between 1 and ${MAX_MEDIA_DIMENSION}px on each side.`);
    }
    const optimized = await sharp(file.buffer).rotate().webp({ quality: 88, effort: 4 }).toBuffer();
    const thumbnail = await sharp(file.buffer).rotate().resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80, effort: 4 }).toBuffer();
    const mediaId = crypto.randomUUID();
    const basePath = `users/${user.uid}/sites/${siteId}/media/${mediaId}`;
    const originalPath = `${basePath}/image.webp`;
    const thumbnailPath = `${basePath}/thumbnail.webp`;
    const objectMetadata = { contentType: 'image/webp', cacheControl: 'public,max-age=31536000,immutable', metadata: { userId: user.uid, siteId, mediaId, purpose } };
    try {
      await adminStorage.file(originalPath).save(optimized, { metadata: objectMetadata, resumable: false, validation: 'crc32c' });
      await adminStorage.file(thumbnailPath).save(thumbnail, { metadata: objectMetadata, resumable: false, validation: 'crc32c' });
      const now = new Date().toISOString();
      const asset = {
        id: mediaId,
        userId: user.uid,
        siteId,
        purpose,
        status: 'ready',
        originalPath,
        thumbnailPath,
        publicUrl: mediaPublicUrl(mediaId),
        thumbnailUrl: mediaThumbnailUrl(mediaId),
        sourceMimeType: file.mimetype,
        mimeType: 'image/webp',
        sourceBytes: file.size,
        bytes: optimized.length,
        thumbnailBytes: thumbnail.length,
        width: metadata.width,
        height: metadata.height,
        createdAt: now,
        updatedAt: now
      };
      await adminDb.collection('media_assets').doc(mediaId).create(asset);
      return res.status(201).json({ media: { ...asset, src: asset.publicUrl, thumbnail: asset.thumbnailUrl } });
    } catch (error) {
      await Promise.all([
        adminStorage.file(originalPath).delete({ ignoreNotFound: true }),
        adminStorage.file(thumbnailPath).delete({ ignoreNotFound: true })
      ]);
      throw error;
    }
  } catch (error) {
    console.error('[Media upload]', error);
    return apiError(res, 503, 'MEDIA_UPLOAD_FAILED', 'The media upload could not be completed.');
  }
});

app.get('/api/media', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  const siteId = typeof req.query.siteId === 'string' ? req.query.siteId.trim() : '';
  if (!siteId) return apiError(res, 400, 'SITE_ID_REQUIRED', 'A site ID is required.');
  try {
    const site = await adminDb.collection('users').doc(user.uid).collection('sites').doc(siteId).get();
    if (!site.exists) return apiError(res, 404, 'SITE_NOT_FOUND', 'Site not found.');
    const snapshot = await adminDb.collection('media_assets').where('userId', '==', user.uid).where('siteId', '==', siteId).where('status', '==', 'ready').orderBy('createdAt', 'desc').limit(501).get();
    return res.json({ media: snapshot.docs.slice(0, 500).map((document) => ({ ...document.data(), src: mediaPublicUrl(document.id), thumbnail: mediaThumbnailUrl(document.id) })), mediaCapped: snapshot.docs.length > 500 });
  } catch (error) {
    console.error('[Media list]', error);
    return apiError(res, 503, 'MEDIA_UNAVAILABLE', 'Media assets are temporarily unavailable.');
  }
});

app.get('/api/media/:mediaId/url', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  try {
    const document = await adminDb.collection('media_assets').doc(String(req.params.mediaId || '')).get();
    const data = document.data();
    const ownedSite = data?.siteId ? await getOwnedSite(user.uid, String(data.siteId)) : null;
    if (!document.exists || data?.userId !== user.uid || !ownedSite || data?.status !== 'ready') return apiError(res, 404, 'MEDIA_NOT_FOUND', 'Media asset not found.');
    const variant = req.query.variant === 'thumbnail' ? 'thumbnailPath' : 'originalPath';
    return res.json({ url: await signedMediaUrl(String(data?.[variant] || '')), expiresAt: new Date(Date.now() + MEDIA_SIGNED_URL_TTL_MS).toISOString() });
  } catch (error) {
    console.error('[Media signed URL]', error);
    return apiError(res, 503, 'MEDIA_URL_UNAVAILABLE', 'The media URL is temporarily unavailable.');
  }
});

app.delete('/api/media/:mediaId', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  const siteId = typeof req.query.siteId === 'string' ? req.query.siteId.trim() : '';
  try {
    const ownedSite = await getOwnedSite(user.uid, siteId);
    if (!ownedSite) return apiError(res, 404, 'SITE_NOT_FOUND', 'Site not found.');
    const document = await adminDb.collection('media_assets').doc(String(req.params.mediaId || '')).get();
    const data = document.data();
    if (!document.exists || data?.userId !== user.uid || data?.siteId !== siteId) return apiError(res, 404, 'MEDIA_NOT_FOUND', 'Media asset not found.');
    const products = await adminDb.collection('creator_products').where('creatorId', '==', user.uid).where('siteId', '==', siteId).limit(500).get();
    const productUses = products.docs.some((product) => collectMediaIds({ imageUrls: product.data()?.imageUrls }).includes(document.id));
    if (collectMediaIds(ownedSite.data).includes(document.id) || productUses) return apiError(res, 409, 'MEDIA_IN_USE', 'Remove this media from the site or product before deleting it.');
    await deleteMediaAsset(document);
    return res.status(204).send();
  } catch (error) {
    console.error('[Media delete]', error);
    return apiError(res, 503, 'MEDIA_DELETE_FAILED', 'The media asset could not be deleted.');
  }
});

app.post('/api/media/cleanup', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  const siteId = typeof req.body?.siteId === 'string' ? req.body.siteId.trim() : '';
  if (!siteId) return apiError(res, 400, 'SITE_ID_REQUIRED', 'A site ID is required.');
  try {
    if (!(await getOwnedSite(user.uid, siteId))) return apiError(res, 404, 'SITE_NOT_FOUND', 'Site not found.');
    const removed = await cleanupOrphanMedia(user.uid, siteId);
    return res.json({ removed });
  } catch (error) {
    console.error('[Media cleanup]', error);
    return apiError(res, 503, 'MEDIA_CLEANUP_FAILED', 'Orphan media cleanup is temporarily unavailable.');
  }
});

app.get('/api/media/public/:mediaId', async (req: Request, res: Response) => {
  const mediaId = String(req.params.mediaId || '').trim();
  if (!/^[a-f0-9-]{36}$/i.test(mediaId)) return res.status(404).send('Media not found');
  try {
    const document = await adminDb.collection('media_assets').doc(mediaId).get();
    const data = document.data();
    if (!document.exists || data?.status !== 'ready') return res.status(404).send('Media not found');
    const site = await adminDb.collection('users').doc(String(data.userId || '')).collection('sites').doc(String(data.siteId || '')).get();
    if (!site.exists || site.data()?.isPublished !== true) return res.status(404).send('Media not found');
    const pathValue = req.query.variant === 'thumbnail' ? data.thumbnailPath : data.originalPath;
    if (typeof pathValue !== 'string' || !pathValue) return res.status(404).send('Media not found');
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
    return res.redirect(302, await signedMediaUrl(pathValue));
  } catch (error) {
    console.error('[Public media]', error);
    return res.status(503).send('Media temporarily unavailable');
  }
});

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
      const fixture = templatesData.find((template) => template.id.toLowerCase() === handle || template.name.toLowerCase() === handle);
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

app.get('/api/sites', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  if (!isAdminConfigured()) return apiError(res, 503, 'SERVICE_NOT_CONFIGURED', 'Site persistence is not configured.');
  try {
    const snapshot = await adminDb.collection('users').doc(user.uid).collection('sites').limit(100).get();
    const sites = snapshot.docs.map((document) => {
      const data = document.data();
      return { id: document.id, username: String(data.username || ''), displayName: String(data.displayName || ''), isPublished: data.isPublished === true, updatedAt: data.updatedAt || null };
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
  const [snapshot, redirect] = await Promise.all([
    adminDb.collectionGroup('sites').where('username', '==', slug).limit(100).get(),
    adminDb.collection('site_slug_redirects').doc(slug).get()
  ]);
  if (redirect.exists) return true;
  return snapshot.docs.some((document) => document.ref.parent.parent?.id !== userId || document.id !== siteId);
}

app.post('/api/sites', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  if (!isAdminConfigured()) return apiError(res, 503, 'SERVICE_NOT_CONFIGURED', 'Site persistence is not configured.');
  const siteId = String(req.body?.siteId || `site_${crypto.randomUUID()}`).trim();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(siteId)) return apiError(res, 400, 'INVALID_SITE_ID', 'Invalid site ID.');
  const profile = await adminDb.collection('users').doc(user.uid).get();
  if (!profile.exists) return apiError(res, 404, 'PROFILE_NOT_FOUND', 'User profile not found.');
  const reference = adminDb.collection('users').doc(user.uid).collection('sites').doc(siteId);
  if ((await reference.get()).exists) return apiError(res, 409, 'SITE_EXISTS', 'A site with this ID already exists.');
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
  if (!siteSchema.valid) return apiError(res, 400, 'INVALID_SITE_CONTENT', 'Site content does not match the shared content schema.', Object.fromEntries(siteSchema.issues.map((issue) => [issue.path, issue.message])));
  Object.assign(site, canonicalSiteToLegacy(normalizedSite));
  if (site.links.some((link: any) => !link || typeof link !== 'object' || typeof link.id !== 'string' || typeof link.title !== 'string' || !isSafePublicUrl(link.url, true))) return apiError(res, 400, 'INVALID_LINKS', 'Every link must have valid text and a safe public URL.');
  const ownedMediaError = await validateOwnedMediaReferences(site, user.uid, siteId);
  if (ownedMediaError) return apiError(res, 400, 'INVALID_MEDIA_REFERENCE', ownedMediaError);
  const entitlement = validateSiteEntitlements(site, profile.data());
  if (entitlement) return entitlementError(res, entitlement.feature, entitlement.message, entitlement.details);
  await reference.create(site);
  return res.status(201).json({ site });
});

app.delete('/api/sites/:siteId', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  if (!isAdminConfigured()) return apiError(res, 503, 'SERVICE_NOT_CONFIGURED', 'Site persistence is not configured.');
  const siteId = String(req.params.siteId || '').trim();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(siteId)) return apiError(res, 400, 'INVALID_SITE_ID', 'Invalid site ID.');
  const reference = adminDb.collection('users').doc(user.uid).collection('sites').doc(siteId);
  const snapshot = await reference.get();
  if (!snapshot.exists) return apiError(res, 404, 'SITE_NOT_FOUND', 'Site not found.');
  if (snapshot.data()?.isPublished === true) return apiError(res, 409, 'SITE_PUBLISHED', 'Unpublish the site before deleting it.');
  if (typeof snapshot.data()?.customDomain === 'string' && snapshot.data()?.customDomain.trim()) return apiError(res, 409, 'SITE_DOMAIN_ATTACHED', 'Remove the custom domain before deleting the site.');
  const redirects = await adminDb.collection('site_slug_redirects').where('siteId', '==', siteId).where('userId', '==', user.uid).limit(100).get();
  if (!redirects.empty) {
    const batch = adminDb.batch();
    redirects.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }
  await reference.delete();
  return res.status(204).send();
});

app.put('/api/sites/:siteId', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  if (!isAdminConfigured()) return apiError(res, 503, 'SERVICE_NOT_CONFIGURED', 'Site persistence is not configured.');
  const siteId = String(req.params.siteId || '').trim();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(siteId)) return apiError(res, 400, 'INVALID_SITE_ID', 'Invalid site ID.');
  const incoming = req.body && typeof req.body === 'object' ? req.body : {};
  const profile = await adminDb.collection('users').doc(user.uid).get();
  const profileData = profile.data();
  if (!profile.exists) return apiError(res, 404, 'PROFILE_NOT_FOUND', 'User profile not found.');
  const existingRef = adminDb.collection('users').doc(user.uid).collection('sites').doc(siteId);
  const existing = await existingRef.get();
  const current = existing.data() || {};
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
  if (!mergedSchema.valid) return apiError(res, 400, 'INVALID_SITE_CONTENT', 'Site content does not match the shared content schema.', Object.fromEntries(mergedSchema.issues.map((issue) => [issue.path, issue.message])));
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
  const slugChanged = existing.exists && previousHandle && previousHandle !== handle;
  const redirectRef = slugChanged ? adminDb.collection('site_slug_redirects').doc(previousHandle) : null;
  if (redirectRef) {
    try {
      await adminDb.runTransaction(async (transaction) => {
        const currentSnapshot = await transaction.get(existingRef);
        const redirectSnapshot = await transaction.get(redirectRef);
        if (!currentSnapshot.exists) throw new Error('SITE_NOT_FOUND');
        const transactionRevision = Number(currentSnapshot.data()?.revision || 0);
        if (expectedRevision !== undefined && transactionRevision !== expectedRevision) throw new Error('SITE_VERSION_CONFLICT');
        if (redirectSnapshot.exists && String(redirectSnapshot.data()?.siteId || '') !== siteId) throw new Error('HANDLE_REDIRECT_CONFLICT');
        transaction.set(redirectRef, {
          oldSlug: previousHandle,
          newSlug: handle,
          siteId,
          userId: user.uid,
          createdAt: redirectSnapshot.data()?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
        transaction.set(existingRef, sanitized, { merge: true });
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'HANDLE_REDIRECT_CONFLICT') {
        return apiError(res, 409, 'HANDLE_REDIRECT_CONFLICT', 'The previous site handle is already reserved by another site.');
      }
      if (error instanceof Error && error.message === 'SITE_VERSION_CONFLICT') {
        const latest = await existingRef.get();
        const latestData = latest.data() || {};
        return res.status(409).json({ status: 'error', error: 'SITE_VERSION_CONFLICT', code: 'SITE_VERSION_CONFLICT', message: 'This site changed elsewhere. Reload the server version before saving again.', site: { ...latestData, id: siteId, userId: user.uid, revision: Number(latestData.revision || 0) } });
      }
      throw error;
    }
  } else {
    try {
      await adminDb.runTransaction(async (transaction) => {
        const currentSnapshot = await transaction.get(existingRef);
        const transactionRevision = Number(currentSnapshot.data()?.revision || 0);
        if (expectedRevision !== undefined && transactionRevision !== expectedRevision) throw new Error('SITE_VERSION_CONFLICT');
        transaction.set(existingRef, sanitized, { merge: true });
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'SITE_VERSION_CONFLICT') {
        const latest = await existingRef.get();
        const latestData = latest.data() || {};
        return res.status(409).json({ status: 'error', error: 'SITE_VERSION_CONFLICT', code: 'SITE_VERSION_CONFLICT', message: 'This site changed elsewhere. Reload the server version before saving again.', site: { ...latestData, id: siteId, userId: user.uid, revision: Number(latestData.revision || 0) } });
      }
      throw error;
    }
  }
  await Promise.all([publicCreatorAdapter.invalidate(handle), previousHandle && previousHandle !== handle ? publicCreatorAdapter.invalidate(previousHandle) : Promise.resolve()]);
  return res.status(existing.exists ? 200 : 201).json({ site: sanitized });
});

app.get('/api/creator/products', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  if (!isAdminConfigured()) return apiError(res, 503, 'PRODUCTS_UNAVAILABLE', 'Product persistence is not configured.');
  try {
    const siteId = typeof req.query.siteId === 'string' ? req.query.siteId.trim() : '';
    if (!siteId) return apiError(res, 400, 'SITE_ID_REQUIRED', 'A site ID is required.');
    const site = await adminDb.collection('users').doc(user.uid).collection('sites').doc(siteId).get();
    if (!site.exists) return apiError(res, 404, 'SITE_NOT_FOUND', 'Site not found.');
    const requestedLimit = Number(req.query.limit || 50);
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
    const cursor = req.query.cursor ? decodePageCursor(req.query.cursor) : null;
    if (req.query.cursor && !cursor) return apiError(res, 400, 'INVALID_CURSOR', 'The products page cursor is invalid or expired.');
    const products = await creatorProducts(user.uid, siteId, limit, cursor);
    return res.status(200).json({ products: products.products.map((product) => publicProduct(product)), hasMore: products.hasMore, nextCursor: products.nextCursor });
  } catch (error) {
    console.error('[Creator products list]', error);
    return apiError(res, 503, 'PRODUCTS_UNAVAILABLE', 'Products are temporarily unavailable.');
  }
});

app.post('/api/creator/products', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  if (!isAdminConfigured() || !stripe) return apiError(res, 503, 'PRODUCTS_UNAVAILABLE', 'Product payments are not configured.');
  const siteId = typeof req.body?.siteId === 'string' ? req.body.siteId.trim() : '';
  if (!siteId || !(await adminDb.collection('users').doc(user.uid).collection('sites').doc(siteId).get()).exists) return apiError(res, 404, 'SITE_NOT_FOUND', 'Site not found.');
  const productInput = normalizeProductInput(req.body);
  const { name, description, imageUrls, priceMinor, currency, inventory, active } = productInput;
  const productSchema = validateProductInput(req.body);
  if (!productSchema.valid) return apiError(res, 400, 'INVALID_PRODUCT', 'Product data does not match the shared content schema.', Object.fromEntries(productSchema.issues.map((issue) => [issue.path, issue.message])));
  if (!name || !Number.isSafeInteger(priceMinor) || priceMinor < 50 || priceMinor > 10_000_000 || !PRODUCT_CURRENCIES.has(currency) || (inventory !== null && (!Number.isSafeInteger(inventory) || inventory < 0))) {
    return apiError(res, 400, 'INVALID_PRODUCT', 'Name, supported currency, valid price, and inventory are required.');
  }
  if (Array.isArray(req.body?.imageUrls) && imageUrls.length !== req.body.imageUrls.length) return apiError(res, 400, 'INVALID_PRODUCT_IMAGES', 'Every product image must be an HTTP(S) URL.');
  const ownedProductMediaError = await validateOwnedMediaReferences({ imageUrls }, user.uid, siteId);
  if (ownedProductMediaError) return apiError(res, 400, 'INVALID_PRODUCT_IMAGES', ownedProductMediaError);
  let stripeProductId = '';
  let stripePriceId = '';
  try {
    const stripeProduct = await stripe.products.create({ name, description, images: imageUrls, active }, { idempotencyKey: `creator_product_${user.uid}_${crypto.randomUUID()}` });
    stripeProductId = stripeProduct.id;
    const stripePrice = await stripe.prices.create({ product: stripeProduct.id, unit_amount: priceMinor, currency, active }, { idempotencyKey: `creator_price_${user.uid}_${crypto.randomUUID()}` });
    stripePriceId = stripePrice.id;
    const reference = adminDb.collection('creator_products').doc();
    const now = new Date().toISOString();
    const product = { id: reference.id, creatorId: user.uid, siteId, name, description, imageUrls, priceMinor, currency, active, inventory, inventoryReserved: 0, stripeProductId: stripeProduct.id, stripePriceId: stripePrice.id, createdAt: now, updatedAt: now };
    await reference.create(product);
    return res.status(201).json({ product: publicProduct(product) });
  } catch (error) {
    if (stripePriceId) await stripe.prices.update(stripePriceId, { active: false }).catch(() => undefined);
    if (stripeProductId) await stripe.products.update(stripeProductId, { active: false }).catch(() => undefined);
    console.error('[Creator product create]', error);
    return apiError(res, 503, 'PRODUCT_CREATE_FAILED', 'Product could not be created.');
  }
});

app.patch('/api/creator/products/:productId', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  if (!isAdminConfigured() || !stripe) return apiError(res, 503, 'PRODUCTS_UNAVAILABLE', 'Product payments are not configured.');
  const productId = String(req.params.productId || '').trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(productId)) return apiError(res, 400, 'INVALID_PRODUCT_ID', 'Invalid product ID.');
  const reference = adminDb.collection('creator_products').doc(productId);
  const snapshot = await reference.get();
  if (!snapshot.exists || snapshot.data()?.creatorId !== user.uid) return apiError(res, 404, 'PRODUCT_NOT_FOUND', 'Product not found.');
  const productSite = await getOwnedSite(user.uid, String(snapshot.data()?.siteId || ''));
  if (!productSite || (typeof req.body?.siteId === 'string' && productSite.id !== req.body.siteId.trim())) return apiError(res, 404, 'PRODUCT_NOT_FOUND', 'Product not found.');
  const current = snapshot.data() || {};
  const normalizedProduct = normalizeProductInput({ ...current, ...req.body });
  const productSchema = validateProductInput({ ...current, ...req.body });
  if (!productSchema.valid) return apiError(res, 400, 'INVALID_PRODUCT', 'Product data does not match the shared content schema.', Object.fromEntries(productSchema.issues.map((issue) => [issue.path, issue.message])));
  const name = req.body?.name === undefined ? String(current.name || '') : normalizedProduct.name;
  const description = req.body?.description === undefined ? String(current.description || '') : normalizedProduct.description;
  const imageUrls = req.body?.imageUrls === undefined ? (Array.isArray(current.imageUrls) ? current.imageUrls : []) : normalizedProduct.imageUrls;
  const priceMinor = req.body?.priceMinor === undefined ? Number(current.priceMinor) : normalizedProduct.priceMinor;
  const currency = req.body?.currency === undefined ? String(current.currency || '') : normalizedProduct.currency;
  const inventory = req.body?.inventory === undefined ? (current.inventory === null || current.inventory === undefined ? null : Number(current.inventory)) : normalizedProduct.inventory;
  const active = req.body?.active === undefined ? current.active === true : normalizedProduct.active;
  const reserved = Number(current.inventoryReserved || 0);
  if (!name || !Number.isSafeInteger(priceMinor) || priceMinor < 50 || priceMinor > 10_000_000 || !PRODUCT_CURRENCIES.has(currency) || (inventory !== null && (!Number.isSafeInteger(inventory) || inventory < reserved))) {
    return apiError(res, 400, 'INVALID_PRODUCT', 'Product fields are invalid or inventory is below currently reserved units.');
  }
  if (req.body?.imageUrls !== undefined && imageUrls.length !== req.body.imageUrls.length) return apiError(res, 400, 'INVALID_PRODUCT_IMAGES', 'Every product image must be an HTTP(S) URL.');
  const ownedProductMediaError = await validateOwnedMediaReferences({ imageUrls }, user.uid, String(current.siteId || ''));
  if (ownedProductMediaError) return apiError(res, 400, 'INVALID_PRODUCT_IMAGES', ownedProductMediaError);
  try {
    await stripe.products.update(String(current.stripeProductId), { name, description, images: imageUrls, active });
    let stripePriceId = String(current.stripePriceId || '');
    if (priceMinor !== Number(current.priceMinor) || currency !== String(current.currency)) {
      const nextPrice = await stripe.prices.create({ product: String(current.stripeProductId), unit_amount: priceMinor, currency, active }, { idempotencyKey: `creator_price_update_${productId}_${crypto.randomUUID()}` });
      if (stripePriceId) await stripe.prices.update(stripePriceId, { active: false });
      stripePriceId = nextPrice.id;
    } else if (stripePriceId) {
      await stripe.prices.update(stripePriceId, { active });
    }
    const updated = { ...current, id: productId, name, description, imageUrls, priceMinor, currency, active, inventory, stripePriceId, updatedAt: new Date().toISOString() };
    await reference.set(updated, { merge: true });
    return res.status(200).json({ product: publicProduct(updated) });
  } catch (error) {
    console.error('[Creator product update]', error);
    return apiError(res, 503, 'PRODUCT_UPDATE_FAILED', 'Product could not be updated.');
  }
});

app.delete('/api/creator/products/:productId', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  if (!isAdminConfigured() || !stripe) return apiError(res, 503, 'PRODUCTS_UNAVAILABLE', 'Product payments are not configured.');
  const reference = adminDb.collection('creator_products').doc(String(req.params.productId || ''));
  const snapshot = await reference.get();
  if (!snapshot.exists || snapshot.data()?.creatorId !== user.uid) return apiError(res, 404, 'PRODUCT_NOT_FOUND', 'Product not found.');
  const productSite = await getOwnedSite(user.uid, String(snapshot.data()?.siteId || ''));
  if (!productSite || (typeof req.query.siteId === 'string' && productSite.id !== req.query.siteId.trim())) return apiError(res, 404, 'PRODUCT_NOT_FOUND', 'Product not found.');
  try {
    await stripe.products.update(String(snapshot.data()?.stripeProductId), { active: false });
    if (snapshot.data()?.stripePriceId) await stripe.prices.update(String(snapshot.data()?.stripePriceId), { active: false });
    await reference.set({ active: false, updatedAt: new Date().toISOString() }, { merge: true });
    return res.status(200).json({ id: reference.id, active: false });
  } catch (error) {
    console.error('[Creator product archive]', error);
    return apiError(res, 503, 'PRODUCT_ARCHIVE_FAILED', 'Product could not be archived.');
  }
});

app.get('/api/v1/public/products/:handle', async (req: Request, res: Response) => {
  const handle = String(req.params.handle || '').trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,30}$/.test(handle)) return apiError(res, 400, 'INVALID_HANDLE', 'Invalid creator handle.');
  if (!isAdminConfigured()) return apiError(res, 503, 'PRODUCTS_UNAVAILABLE', 'Products are not configured.');
  const site = await getPublishedSiteByHandle(handle).catch(() => null);
  if (!site) return apiError(res, 404, 'CREATOR_NOT_FOUND', 'Creator page not found.');
  const products = await adminDb.collection('creator_products').where('creatorId', '==', String(site.userId)).where('active', '==', true).limit(100).get();
  return res.status(200).json({ products: products.docs.filter((document) => String(document.data()?.siteId || '') === String(site.id || '')).map((document) => publicProduct({ id: document.id, ...document.data() })) });
});

app.post('/api/v1/public/products/:handle/checkout', async (req: Request, res: Response) => {
  const handle = String(req.params.handle || '').trim().toLowerCase();
  const productId = typeof req.body?.productId === 'string' ? req.body.productId.trim() : '';
  const quantity = Number(req.body?.quantity || 1);
  const customerEmail = typeof req.body?.customerEmail === 'string' ? req.body.customerEmail.trim().toLowerCase() : '';
  if (!/^[a-z0-9_-]{3,30}$/.test(handle) || !/^[A-Za-z0-9_-]{1,128}$/.test(productId) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20 || !validEmail(customerEmail)) return apiError(res, 400, 'INVALID_ORDER', 'A valid product, quantity, and email are required.');
  if (!isAdminConfigured() || !stripe) return apiError(res, 503, 'CHECKOUT_UNAVAILABLE', 'Checkout is not configured.');
  const rate = await enforceRateLimitPolicy('checkoutCreation', { ip: clientIdentity(req), site: handle });
  if (!rate.allowed) return res.status(429).set('Retry-After', String(rate.retryAfter)).json({ error: 'Too many checkout attempts', retry_after: rate.retryAfter });
  const idempotencyKey = req.headers['idempotency-key'];
  if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 16 || idempotencyKey.length > 200) return apiError(res, 400, 'IDEMPOTENCY_REQUIRED', 'Idempotency-Key header is required.');
  const site = await getPublishedSiteByHandle(handle).catch(() => null);
  if (!site) return apiError(res, 404, 'CREATOR_NOT_FOUND', 'Creator page not found.');
  const productRef = adminDb.collection('creator_products').doc(productId);
  const orderRef = adminDb.collection('orders').doc();
  const orderCreatedEvent = createOutboxEvent({ id: outboxEventId(`order:${orderRef.id}:created`), eventType: eventType(DOMAIN_EVENTS.OrderCreated), aggregateType: 'order', aggregateId: orderRef.id, idempotencyKey: `order:${orderRef.id}:created`, payload: { orderId: orderRef.id, productId, siteId: String(site.id || ''), creatorId: String(site.userId) } });
  const now = new Date().toISOString();
  try {
    const claimed = await claimIdempotency('product-checkout', idempotencyKey);
    if (claimed.inProgress) return apiError(res, 409, 'IDEMPOTENCY_IN_PROGRESS', 'This checkout is already being processed.');
    if (claimed.replay && claimed.response) return res.status(201).json(claimed.response);
    const order = await adminDb.runTransaction(async (transaction) => {
      const productSnapshot = await transaction.get(productRef);
      if (!productSnapshot.exists || productSnapshot.data()?.creatorId !== String(site.userId) || String(productSnapshot.data()?.siteId || '') !== String(site.id || '') || productSnapshot.data()?.active !== true) throw new Error('PRODUCT_NOT_FOUND');
      const product = productSnapshot.data() || {};
      const available = product.inventory === null || product.inventory === undefined ? null : Number(product.inventory) - Number(product.inventoryReserved || 0);
      if (available !== null && available < quantity) throw new Error('OUT_OF_STOCK');
      const unitPriceMinor = Number(product.priceMinor);
      const orderData = { id: orderRef.id, creatorId: String(site.userId), siteId: String(site.id || ''), creatorHandle: handle, productId, productName: String(product.name), quantity, unitPriceMinor, currency: String(product.currency), totalMinor: unitPriceMinor * quantity, customerEmail, status: 'pending_payment', fulfillmentStatus: 'unfulfilled', inventoryReservation: quantity, createdAt: now, updatedAt: now };
      transaction.update(productRef, { inventoryReserved: Number(product.inventoryReserved || 0) + quantity, updatedAt: now });
      transaction.create(orderRef, orderData);
      appendOutboxEvent(transaction, adminDb, orderCreatedEvent);
      return { orderData, stripePriceId: String(product.stripePriceId) };
    });
    const session = await stripe.checkout.sessions.create({ mode: 'payment', line_items: [{ price: order.stripePriceId, quantity }], customer_email: customerEmail, success_url: `${APP_URL}/?order=success&order_id=${encodeURIComponent(orderRef.id)}`, cancel_url: `${APP_URL}/?order=cancelled&order_id=${encodeURIComponent(orderRef.id)}`, metadata: { orderId: orderRef.id, productId, creatorId: String(site.userId), creatorHandle: handle } }, { idempotencyKey: `creator_order_${idempotencyKey}` });
    if (!session.url) throw new Error('STRIPE_CHECKOUT_URL_MISSING');
    await orderRef.set({ stripeCheckoutSessionId: session.id, updatedAt: new Date().toISOString() }, { merge: true });
    const response = { id: orderRef.id, status: 'pending_payment', url: session.url };
    await completeIdempotency('product-checkout', idempotencyKey, response);
    return res.status(201).json(response);
  } catch (error) {
    if (error instanceof Error && ['PRODUCT_NOT_FOUND', 'OUT_OF_STOCK'].includes(error.message)) return apiError(res, error.message === 'OUT_OF_STOCK' ? 409 : 404, error.message, error.message === 'OUT_OF_STOCK' ? 'The requested quantity is no longer available.' : 'Product not found.');
    await adminDb.runTransaction(async (transaction) => {
      const outboxReference = adminDb.collection('outbox_events').doc(orderCreatedEvent.id);
      const [orderSnapshot, productSnapshot, outboxSnapshot] = await Promise.all([transaction.get(orderRef), transaction.get(productRef), transaction.get(outboxReference)]);
      if (orderSnapshot.exists && orderSnapshot.data()?.status === 'pending_payment') transaction.delete(orderRef);
      if (outboxSnapshot.exists && outboxSnapshot.data()?.status === 'pending') transaction.delete(outboxReference);
      if (productSnapshot.exists && productSnapshot.data()?.creatorId === String(site.userId)) transaction.update(productRef, { inventoryReserved: Math.max(0, Number(productSnapshot.data()?.inventoryReserved || 0) - quantity), updatedAt: new Date().toISOString() });
    }).catch(() => undefined);
    console.error('[Public product checkout]', error);
    return apiError(res, 503, 'CHECKOUT_UNAVAILABLE', 'Checkout is temporarily unavailable.');
  }
});

app.get('/api/account/orders', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  if (!isAdminConfigured()) return apiError(res, 503, 'ORDERS_UNAVAILABLE', 'Order history is not configured.');
  const profile = await adminDb.collection('users').doc(user.uid).get();
  const email = String(user.email || profile.data()?.email || '').toLowerCase();
  const requestedSiteId = typeof req.query.siteId === 'string' ? req.query.siteId.trim() : '';
  if (requestedSiteId && !(await adminDb.collection('users').doc(user.uid).collection('sites').doc(requestedSiteId).get()).exists) return apiError(res, 404, 'SITE_NOT_FOUND', 'Site not found.');
  const [creatorOrders, customerOrders] = await Promise.all([
    adminDb.collection('orders').where('creatorId', '==', user.uid).limit(100).get(),
    email ? adminDb.collection('orders').where('customerEmail', '==', email).limit(100).get() : Promise.resolve({ docs: [] } as any)
  ]);
  const unique = new Map<string, Record<string, unknown>>();
  [...creatorOrders.docs, ...customerOrders.docs].filter((document) => !requestedSiteId || String(document.data()?.siteId || '') === requestedSiteId).forEach((document) => unique.set(document.id, { id: document.id, ...document.data() }));
  return res.status(200).json({ orders: [...unique.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))) });
});

app.get('/api/creator/orders', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  if (!isAdminConfigured()) return apiError(res, 503, 'ORDERS_UNAVAILABLE', 'Order management is not configured.');
  const requestedSiteId = typeof req.query.siteId === 'string' ? req.query.siteId.trim() : '';
  if (requestedSiteId && !(await getOwnedSite(user.uid, requestedSiteId))) {
    return apiError(res, 404, 'SITE_NOT_FOUND', 'Site not found.');
  }
  try {
    const requestedLimit = Number(req.query.limit || 50);
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
    const cursor = req.query.cursor ? decodePageCursor(req.query.cursor) : null;
    if (req.query.cursor && !cursor) return apiError(res, 400, 'INVALID_CURSOR', 'The orders page cursor is invalid or expired.');
    let query: Query = adminDb.collection('orders').where('creatorId', '==', user.uid).orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc').limit(limit + 1);
    if (cursor) query = query.startAfter(cursor.createdAt, cursor.id);
    const snapshot = await query.get();
    const rawOrders = snapshot.docs.map((document) => ({ id: document.id, ...document.data() })) as Array<Record<string, unknown>>;
    const missingSiteOrders = rawOrders.filter((order) => !order.siteId && typeof order.productId === 'string');
    const productSnapshots = missingSiteOrders.length
      ? await adminDb.getAll(...missingSiteOrders.map((order) => adminDb.collection('creator_products').doc(String(order.productId))))
      : [];
    const productSiteById = new Map(productSnapshots.map((product) => [product.id, String(product.data()?.siteId || '')]));
    const orders = rawOrders
      .map((order): Record<string, unknown> => ({ ...order, siteId: String(order.siteId || productSiteById.get(String(order.productId || '')) || '') }))
      .filter((order) => !requestedSiteId || String(order.siteId || '') === requestedSiteId)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    const lastScanned = snapshot.docs[snapshot.docs.length - 1];
    return res.status(200).json({
      orders: orders.slice(0, limit),
      hasMore: snapshot.docs.length > limit,
      nextCursor: snapshot.docs.length > limit && lastScanned ? encodePageCursor({ createdAt: String(lastScanned.data()?.createdAt || ''), id: lastScanned.id }) : null
    });
  } catch (error) {
    console.error('[Creator orders list]', error);
    return apiError(res, 503, 'ORDERS_UNAVAILABLE', 'Orders are temporarily unavailable.');
  }
});

app.patch('/api/creator/orders/:orderId/fulfillment', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  if (!isAdminConfigured()) return apiError(res, 503, 'ORDERS_UNAVAILABLE', 'Order management is not configured.');
  const fulfillmentStatus = String(req.body?.fulfillmentStatus || '').trim();
  if (!['processing', 'fulfilled', 'cancelled'].includes(fulfillmentStatus)) return apiError(res, 400, 'INVALID_FULFILLMENT_STATUS', 'Invalid fulfillment status.');
  const orderId = String(req.params.orderId || '').trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(orderId)) return apiError(res, 400, 'INVALID_ORDER_ID', 'Invalid order ID.');
  const requestedSiteId = typeof req.body?.siteId === 'string' ? req.body.siteId.trim() : '';
  const reference = adminDb.collection('orders').doc(orderId);
  try {
    const existingOrder = await reference.get();
    if (!existingOrder.exists || existingOrder.data()?.creatorId !== user.uid) throw new Error('ORDER_NOT_FOUND');
    const existingOrderData = existingOrder.data() || {};
    let resolvedOrderSiteId = String(existingOrderData.siteId || '');
    if (!resolvedOrderSiteId && existingOrderData.productId) {
      const productSnapshot = await adminDb.collection('creator_products').doc(String(existingOrderData.productId)).get();
      if (productSnapshot.exists && productSnapshot.data()?.creatorId === user.uid) resolvedOrderSiteId = String(productSnapshot.data()?.siteId || '');
    }
    if (!resolvedOrderSiteId || !(await getOwnedSite(user.uid, resolvedOrderSiteId)) || (requestedSiteId && requestedSiteId !== resolvedOrderSiteId)) throw new Error('ORDER_NOT_FOUND');
    const result = await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists || snapshot.data()?.creatorId !== user.uid) throw new Error('ORDER_NOT_FOUND');
      const order = snapshot.data() || {};
      if (requestedSiteId && String(order.siteId || '') !== requestedSiteId) {
        if (order.siteId || !order.productId) throw new Error('ORDER_NOT_FOUND');
        const productSnapshot = await transaction.get(adminDb.collection('creator_products').doc(String(order.productId)));
        if (!productSnapshot.exists || productSnapshot.data()?.creatorId !== user.uid || String(productSnapshot.data()?.siteId || '') !== requestedSiteId) throw new Error('ORDER_NOT_FOUND');
      }

      const current = String(order.fulfillmentStatus || 'unfulfilled');
      const allowedTransitions: Record<string, string[]> = {
        unfulfilled: ['processing', 'cancelled'],
        processing: ['fulfilled', 'cancelled'],
        fulfilled: [],
        cancelled: []
      };
      if (!allowedTransitions[current]?.includes(fulfillmentStatus)) throw new Error(`INVALID_FULFILLMENT_TRANSITION:${current}`);
      if (fulfillmentStatus !== 'cancelled' && order.status !== 'paid') throw new Error('ORDER_NOT_PAID');
      if (fulfillmentStatus === 'fulfilled' && Number(order.quantity || 0) < 1) throw new Error('INVALID_ORDER_QUANTITY');

      const currentState = legacyOrderState(order.state, order.fulfillmentStatus || order.status);
      const targetState = fulfillmentStatus === 'processing' ? 'processing' : fulfillmentStatus === 'fulfilled' ? 'fulfilled' : 'cancelled';
      if (currentState !== targetState) {
        try {
          assertOrderTransition(currentState, targetState);
        } catch {
          throw new Error(`INVALID_FULFILLMENT_TRANSITION:${current}`);
        }
      }

      const now = new Date().toISOString();
      const history = Array.isArray(order.fulfillmentHistory) ? order.fulfillmentHistory : [];
      const nextHistory = [...history, { from: current, to: fulfillmentStatus, at: now, actorId: user.uid }].slice(-50);
      const updates: Record<string, unknown> = { fulfillmentStatus, fulfillmentHistory: nextHistory, state: targetState, updatedAt: now };

      // Pending-payment cancellations release the reservation. Once payment has
      // consumed the reservation, a paid cancellation returns the units to stock.
      // inventoryReservation prevents double reconciliation.
      const reservation = Math.max(0, Number(order.inventoryReservation || 0));
      if (fulfillmentStatus === 'cancelled') {
        const productId = String(order.productId || '');
        if (productId) {
          const productRef = adminDb.collection('creator_products').doc(productId);
          const productSnapshot = await transaction.get(productRef);
          if (!productSnapshot.exists || productSnapshot.data()?.creatorId !== user.uid) throw new Error('PRODUCT_NOT_FOUND');
          const product = productSnapshot.data() || {};
          if (reservation > 0) {
            transaction.update(productRef, { inventoryReserved: Math.max(0, Number(product.inventoryReserved || 0) - reservation), updatedAt: now });
            updates.inventoryReservation = 0;
            updates.inventoryReconciledAt = now;
            updates.inventoryReconciledQuantity = reservation;
          } else if (order.status === 'paid' && product.inventory !== null && product.inventory !== undefined) {
            transaction.update(productRef, { inventory: Math.max(0, Number(product.inventory || 0) + Number(order.quantity || 0)), updatedAt: now });
            updates.inventoryReconciledAt = now;
            updates.inventoryReconciledQuantity = Number(order.quantity || 0);
          }
        }
      }
      if (currentState !== targetState) {
        const transitionKey = `api:${user.uid}:${req.headers['x-request-id'] || crypto.randomUUID()}`;
        transaction.create(reference.collection('stateTransitions').doc(crypto.createHash('sha256').update(transitionKey).digest('hex')), {
          orderId,
          from: currentState,
          to: targetState,
          source: 'api',
          actorUserId: user.uid,
          transitionKey,
          createdAt: now
        });
      }
      transaction.update(reference, updates);
      return { id: reference.id, ...order, ...updates };
    });
    return res.status(200).json({ order: result });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'ORDER_NOT_FOUND' || code === 'PRODUCT_NOT_FOUND') return apiError(res, 404, 'ORDER_NOT_FOUND', 'Order not found.');
    if (code === 'ORDER_NOT_PAID') return apiError(res, 409, 'ORDER_NOT_PAID', 'Only paid orders can be fulfilled.');
    if (code.startsWith('INVALID_FULFILLMENT_TRANSITION:')) return apiError(res, 409, 'INVALID_FULFILLMENT_TRANSITION', `Order is already ${code.split(':')[1]}.`);
    if (code === 'INVALID_ORDER_QUANTITY') return apiError(res, 409, 'INVALID_ORDER_QUANTITY', 'The order quantity is invalid.');
    console.error('[Creator order fulfillment]', error);
    return apiError(res, 503, 'FULFILLMENT_UPDATE_FAILED', 'Order fulfillment could not be updated.');
  }
});

app.post('/api/billing/activate-free', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  if (isAdminConfigured()) {
    await adminDb.collection('users').doc(user.uid).set({
      plan: 'free',
      isYearly: false,
      billingStatus: 'free',
      updatedAt: new Date().toISOString()
    }, { merge: true });
  }

  return res.status(200).json({ plan: 'free' });
});

app.post('/api/billing/checkout-session', async (req: Request, res: Response) => {
  return billingController.checkout(req, res);
});

app.get('/api/billing/checkout-session', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id : '';
  if (!sessionId) return res.status(400).json({ error: 'session_id is required' });

  try {
    const status = await getCheckoutSessionStatus(user.uid, sessionId);
    if (!status) return res.status(404).json({ error: 'Checkout session not found' });
    return res.status(200).json(status);
  } catch (error) {
    console.error('[Billing checkout status]', error);
    return res.status(503).json({ error: 'Checkout status is temporarily unavailable' });
  }
});

app.post('/api/v1/referrals/qualify', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  if (!isAdminConfigured()) return res.status(503).json({ error: 'Referral service is not configured' });

  const code = typeof req.body?.code === 'string' ? req.body.code.trim().toLowerCase() : '';
  if (!code) return res.status(400).json({ error: 'Referral code is required' });

  try {
    const referrerSnapshot = await adminDb.collection('users').where('handle', '==', code).limit(1).get();
    const referrerDocument = referrerSnapshot.docs[0];
    if (!referrerDocument) return res.status(404).json({ error: 'Referral code not found' });
    const referrerId = referrerDocument.id;
    if (!referrerId || referrerId === user.uid) return res.status(400).json({ error: 'Invalid referral' });

    const referrerRef = adminDb.collection('users').doc(referrerId);
    const referredRef = adminDb.collection('users').doc(user.uid);
    const referralRef = referrerRef.collection('referrals').doc(user.uid);
    const result = await adminDb.runTransaction(async (transaction) => {
      const [referrerSnapshot, referredSnapshot, referralSnapshot] = await Promise.all([
        transaction.get(referrerRef),
        transaction.get(referredRef),
        transaction.get(referralRef)
      ]);
      if (!referrerSnapshot.exists || !referredSnapshot.exists || referralSnapshot.exists) return false;
      if (referrerSnapshot.data()?.email === referredSnapshot.data()?.email) return false;

      const currentCount = Number(referrerSnapshot.data()?.referralsCount || 0);
      const nextCount = currentCount + 1;
      const earnedBefore = Math.floor(currentCount / 3);
      const earnedAfter = Math.floor(nextCount / 3);
      const newFreeMonths = earnedAfter - earnedBefore;
      const existingUntil = Date.parse(referrerSnapshot.data()?.referralProUntil || '') || 0;
      const baseDate = Math.max(Date.now(), existingUntil);
      const rewards = {
        verifiedBadgeUnlocked: nextCount >= 1,
        freeProMonthsEarned: earnedAfter,
        customDomainUnlocked: nextCount >= 5
      };

      transaction.set(referrerRef, {
        referralsCount: nextCount,
        referralRewards: rewards,
        referralProUntil: newFreeMonths > 0
          ? new Date(baseDate + newFreeMonths * 30 * 24 * 60 * 60 * 1000).toISOString()
          : referrerSnapshot.data()?.referralProUntil || null,
        verifiedCreator: rewards.verifiedBadgeUnlocked,
        customDomainPerkUnlocked: rewards.customDomainUnlocked,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      transaction.create(referralRef, { referredUserId: user.uid, status: 'qualified', qualifiedAt: new Date().toISOString() });
      transaction.set(referredRef, { referredBy: referrerId, referralStatus: 'qualified', updatedAt: new Date().toISOString() }, { merge: true });
      return true;
    });
    return res.status(200).json({ qualified: result });
  } catch (error) {
    console.error('[Referral qualification]', error);
    return res.status(503).json({ error: 'Referral qualification is temporarily unavailable' });
  }
});

app.post('/api/billing/portal-session', async (req: Request, res: Response) => {
  return billingController.portal(req, res);
});

app.get('/api/integrations/providers', async (_req: Request, res: Response) => {
  const github = githubConfig();
  return res.json({ providers: [{ provider: 'github', label: 'GitHub', available: Boolean(github && integrationEncryptionConfigured()), scopes: OAUTH_SCOPES.github }] });
});

app.get('/api/integrations', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  if (!isAdminConfigured()) return apiError(res, 503, 'INTEGRATIONS_UNAVAILABLE', 'Social integrations are not configured.');
  try {
    const snapshot = await adminDb.collection('creator_integrations').where('userId', '==', user.uid).get();
    return res.json({ integrations: snapshot.docs.map((doc) => publicIntegration(doc.data() as StoredIntegration)) });
  } catch (error) {
    console.error('[Social integrations list]', error);
    return apiError(res, 503, 'INTEGRATIONS_UNAVAILABLE', 'Social integration status is temporarily unavailable.');
  }
});

app.get('/api/integrations/github/start', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  const config = githubConfig();
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  if (!config || !integrationEncryptionConfigured() || !isAdminConfigured()) return apiError(res, 503, 'GITHUB_NOT_CONFIGURED', 'GitHub integration is not configured.');
  const oauthRate = await enforceRateLimitPolicy('oauthFlows', { ip: clientIdentity(req), user: user.uid, provider: 'github' });
  if (!oauthRate.allowed) return res.status(429).set('Retry-After', String(oauthRate.retryAfter)).json({ error: 'Too many OAuth attempts', retry_after: oauthRate.retryAfter });
  const nonce = crypto.randomBytes(24).toString('base64url');
  const expiresAt = Date.now() + OAUTH_STATE_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ uid: user.uid, nonce, exp: expiresAt })).toString('base64url');
  const state = `${payload}.${signOAuthState(payload)}`;
  await adminDb.collection('oauth_states').doc(nonce).set({ userId: user.uid, provider: 'github', expiresAt, createdAt: new Date().toISOString() });
  const authorizeUrl = socialAdapters.github.authorizeUrl(config, state);
  if (req.query.format === 'json') return res.json({ url: authorizeUrl });
  return res.redirect(authorizeUrl);
});

app.get('/api/integrations/github/callback', async (req: Request, res: Response) => {
  const config = githubConfig();
  const fail = (code: string) => res.redirect(`${APP_URL}/studio?integration=github&status=error&code=${encodeURIComponent(code)}`);
  if (!config || !integrationEncryptionConfigured() || !isAdminConfigured()) return fail('not_configured');
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  if (!code || !state) return fail('missing_callback_parameters');
  try {
    const [payload, signature] = state.split('.');
    const expectedSignature = payload ? signOAuthState(payload) : '';
    if (!payload || !signature || signature.length !== expectedSignature.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return fail('invalid_state');
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { uid: string; nonce: string; exp: number };
    if (!decoded.uid || !decoded.nonce || decoded.exp < Date.now()) return fail('expired_state');
    const stateRef = adminDb.collection('oauth_states').doc(decoded.nonce);
    const stateDoc = await stateRef.get();
    if (!stateDoc.exists || stateDoc.data()?.userId !== decoded.uid || stateDoc.data()?.provider !== 'github' || Number(stateDoc.data()?.expiresAt) < Date.now()) return fail('invalid_state');
    await stateRef.delete();

    const { accessToken } = await socialAdapters.github.exchangeCode(config, code);
    const account = await socialAdapters.github.getProfile(accessToken);
    const now = new Date().toISOString();
    const integration: StoredIntegration = {
      provider: 'github', userId: decoded.uid, providerAccountId: account.id, accountLabel: account.label,
      profileUrl: account.profileUrl, scopes: OAUTH_SCOPES.github, status: 'connected', encryptedAccessToken: encryptIntegrationToken(accessToken),
      tokenExpiresAt: null, connectedAt: now, updatedAt: now
    };
    await adminDb.collection('creator_integrations').doc(`${decoded.uid}_github`).set(integration, { merge: true });
    return res.redirect(`${APP_URL}/studio?integration=github&status=connected`);
  } catch (error) {
    console.error('[GitHub OAuth callback]', error);
    return fail('oauth_failed');
  }
});

app.post('/api/integrations/:provider/refresh', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  const provider = req.params.provider;
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  if (provider !== 'github') return apiError(res, 404, 'INTEGRATION_PROVIDER_NOT_FOUND', 'Unsupported social integration.');
  const ref = adminDb.collection('creator_integrations').doc(`${user.uid}_${provider}`);
  const snapshot = await ref.get();
  if (!snapshot.exists) return apiError(res, 404, 'INTEGRATION_NOT_CONNECTED', 'This integration is not connected.');
  const integration = snapshot.data() as StoredIntegration;
  try {
    await socialAdapters.github.validateToken(decryptIntegrationToken(integration.encryptedAccessToken));
    await ref.set({ status: 'connected', lastError: null, updatedAt: new Date().toISOString() }, { merge: true });
    return res.json({ integration: publicIntegration({ ...integration, status: 'connected', updatedAt: new Date().toISOString() }) });
  } catch (error) {
    await ref.set({ status: 'reauthorization_required', lastError: 'Provider authorization has expired or was revoked.', updatedAt: new Date().toISOString() }, { merge: true });
    return apiError(res, 409, 'INTEGRATION_REAUTH_REQUIRED', 'Reconnect this social account to continue.');
  }
});

app.delete('/api/integrations/:provider', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  const provider = req.params.provider;
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  if (provider !== 'github') return apiError(res, 404, 'INTEGRATION_PROVIDER_NOT_FOUND', 'Unsupported social integration.');
  const ref = adminDb.collection('creator_integrations').doc(`${user.uid}_${provider}`);
  const snapshot = await ref.get();
  if (snapshot.exists) {
    const integration = snapshot.data() as StoredIntegration;
    const config = githubConfig();
    if (config) {
      try {
        await socialAdapters.github.revokeToken(config, decryptIntegrationToken(integration.encryptedAccessToken));
      } catch (error) { console.warn('[GitHub token revoke]', error); }
    }
    await ref.delete();
  }
  return res.status(204).send();
});

function calendarTokenStorageConfigured(): boolean {
  return Boolean((process.env.INTEGRATION_ENCRYPTION_KEY && process.env.INTEGRATION_ENCRYPTION_KEY.length >= 32) || (process.env.NODE_ENV !== 'production' && AUTH_SESSION_SECRET.length >= 32));
}

app.get('/api/calendar/integrations', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  if (!isAdminConfigured()) return apiError(res, 503, 'CALENDAR_UNAVAILABLE', 'Calendar integrations are not configured.');
  try {
    const snapshot = await adminDb.collection('calendar_integrations').where('userId', '==', user.uid).get();
    return res.json({ integrations: snapshot.docs.map((doc) => { const value = doc.data(); return { provider: value.provider, status: value.status, scopes: value.scopes || [], connectedAt: value.connectedAt, updatedAt: value.updatedAt, lastError: value.lastError || undefined }; }) });
  } catch (error) {
    console.error('[Calendar integrations list]', error);
    return apiError(res, 503, 'CALENDAR_UNAVAILABLE', 'Calendar integration status is temporarily unavailable.');
  }
});

app.get('/api/calendar/:provider/start', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  const provider = req.params.provider as CalendarProvider;
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  if (!['google', 'outlook'].includes(provider)) return apiError(res, 404, 'CALENDAR_PROVIDER_NOT_FOUND', 'Unsupported calendar provider.');
  try {
    await entitlementService.assertEntitled(user.uid, 'studioControls');
  } catch {
    return entitlementError(res, 'studioControls', 'Calendar integrations require the Studio plan.');
  }
  const configuration = calendarOAuthConfiguration(provider);
  if (!configuration || !calendarTokenStorageConfigured() || !isAdminConfigured()) return apiError(res, 503, 'CALENDAR_NOT_CONFIGURED', 'Calendar OAuth is not configured.');
  const nonce = crypto.randomBytes(24).toString('base64url');
  const expiresAt = Date.now() + 10 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ uid: user.uid, nonce, exp: expiresAt, provider })).toString('base64url');
  const state = `${payload}.${signOAuthState(payload)}`;
  await adminDb.collection('oauth_states').doc(nonce).set({ userId: user.uid, provider: `calendar:${provider}`, expiresAt, createdAt: new Date().toISOString() });
  const url = calendarAdapter(provider).authorizeUrl(state);
  if (req.query.format === 'json') return res.json({ url });
  return res.redirect(url);
});

app.get('/api/calendar/:provider/callback', async (req: Request, res: Response) => {
  const provider = req.params.provider as CalendarProvider;
  const fail = (code: string) => res.redirect(`${APP_URL}/studio?calendar=${encodeURIComponent(provider)}&status=error&code=${encodeURIComponent(code)}`);
  if (!['google', 'outlook'].includes(provider) || !calendarOAuthConfiguration(provider) || !calendarTokenStorageConfigured() || !isAdminConfigured()) return fail('not_configured');
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  if (!code || !state) return fail('missing_callback_parameters');
  try {
    const [payload, signature] = state.split('.');
    const expected = payload ? signOAuthState(payload) : '';
    if (!payload || !signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return fail('invalid_state');
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { uid: string; nonce: string; exp: number; provider: CalendarProvider };
    if (decoded.provider !== provider || !decoded.uid || !decoded.nonce || decoded.exp < Date.now()) return fail('expired_state');
    const stateRef = adminDb.collection('oauth_states').doc(decoded.nonce);
    const stateSnapshot = await stateRef.get();
    if (!stateSnapshot.exists || stateSnapshot.data()?.userId !== decoded.uid || stateSnapshot.data()?.provider !== `calendar:${provider}` || Number(stateSnapshot.data()?.expiresAt) < Date.now()) return fail('invalid_state');
    await stateRef.delete();
    const tokens = await calendarAdapter(provider).exchangeCode(code);
    const now = new Date().toISOString();
    await adminDb.collection('calendar_integrations').doc(`${decoded.uid}_${provider}`).set({ userId: decoded.uid, provider, status: 'connected', scopes: calendarOAuthConfiguration(provider)!.scopes, encryptedTokens: encryptCalendarTokens(tokens), expiresAt: tokens.expiresAt, connectedAt: now, updatedAt: now }, { merge: true });
    return res.redirect(`${APP_URL}/studio?calendar=${encodeURIComponent(provider)}&status=connected`);
  } catch (error) {
    console.error('[Calendar OAuth callback]', error);
    return fail('oauth_failed');
  }
});

app.delete('/api/calendar/:provider', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  const provider = req.params.provider as CalendarProvider;
  if (!user) return apiError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  if (!['google', 'outlook'].includes(provider)) return apiError(res, 404, 'CALENDAR_PROVIDER_NOT_FOUND', 'Unsupported calendar provider.');
  await adminDb.collection('calendar_integrations').doc(`${user.uid}_${provider}`).delete();
  return res.status(204).send();
});

app.get('/api/domains', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  if (!isAdminConfigured()) return apiError(res, 503, 'DOMAINS_UNAVAILABLE', 'Custom domain persistence is temporarily unavailable.');

  try {
    const snapshot = await adminDb.collection('custom_domains').where('userId', '==', user.uid).get();
    const domains = (await Promise.all(snapshot.docs.map(async (document) => {
      const domain = document.data();
      return await getOwnedSite(user.uid, String(domain.siteId || '')) ? domain : null;
    }))).filter(Boolean);
    return res.status(200).json({ domains });
  } catch (error) {
    console.error('[Domain list]', error);
    return apiError(res, 503, 'DOMAINS_UNAVAILABLE', 'Custom domain status is temporarily unavailable.');
  }
});

app.post('/api/domains/provision', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  if (!isAdminConfigured() || !getCloudflareConfig()) return res.status(503).json({ error: 'Domain provisioning is not configured' });

  const hostname = normalizeHostname(req.body?.hostname);
  const requestedSiteId = typeof req.body?.siteId === 'string' ? req.body.siteId.trim() : '';
  if (!hostname) return res.status(400).json({ error: 'A valid customer-owned hostname is required' });
  if (requestedSiteId && !/^[a-zA-Z0-9_-]{1,64}$/.test(requestedSiteId)) return res.status(400).json({ error: 'Invalid site ID' });

  try {
    await entitlementService.assertEntitled(user.uid, 'customDomains');
  } catch {
    return entitlementError(res, 'customDomains', 'Custom domains require a Pro or Studio plan.');
  }

  const userProfile = await adminDb.collection('users').doc(user.uid).get();
  const sitesCollection = adminDb.collection('users').doc(user.uid).collection('sites');
  const siteSnapshot = requestedSiteId
    ? await sitesCollection.doc(requestedSiteId).get()
    : (await sitesCollection.limit(100).get()).docs.find((document) => document.data()?.isPublished === true);
  if (!siteSnapshot || !siteSnapshot.exists) return res.status(404).json({ error: 'Site not found' });
  if (siteSnapshot.data()?.isPublished !== true) return res.status(409).json({ error: 'Publish the site before attaching a domain' });
  const siteId = siteSnapshot.id;
  const siteHandle = String(siteSnapshot.data()?.username || userProfile.data()?.handle || '').trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,30}$/.test(siteHandle)) return res.status(409).json({ error: 'Site handle is not configured' });

  const existing = await findDomainByHostname(hostname);
  if (existing && existing.userId !== user.uid) return res.status(409).json({ error: 'Domain is already attached' });
  if (existing) {
    if (!(await getOwnedSite(user.uid, existing.siteId))) return res.status(409).json({ error: 'Domain is already attached to an invalid site' });
    return res.status(200).json({ domain: existing });
  }

  let reservedDomainId = '';
  try {
    const domainId = crypto.createHash('sha256').update(hostname).digest('hex').slice(0, 32);
    reservedDomainId = domainId;
    const domainRef = adminDb.collection('custom_domains').doc(domainId);
    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(domainRef);
      if (snapshot.exists && snapshot.data()?.userId !== user.uid) throw new Error('DOMAIN_ALREADY_RESERVED');
      if (!snapshot.exists) {
        const now = new Date().toISOString();
        transaction.create(domainRef, {
          domainId,
          hostname,
          userId: user.uid,
          siteId,
          siteHandle,
          verificationStatus: 'pending',
          sslStatus: 'pending',
          createdAt: now,
          updatedAt: now
        });
      }
    });
    const cloudflare = await cloudflareRequest(
      `/zones/${getCloudflareConfig()!.zoneId}/custom_hostnames`,
      {
        method: 'POST',
        body: JSON.stringify({
          hostname,
          custom_metadata: { raloaDomainId: domainId, userId: user.uid, siteId, siteHandle },
          ssl: { method: 'http', type: 'dv', settings: { http2: 'on', min_tls_version: '1.2' } }
        })
      }
    );
    const now = new Date().toISOString();
    const domain: DomainRecord = {
      domainId,
      hostname,
      userId: user.uid,
      siteId,
      siteHandle,
      verificationToken: crypto.randomBytes(24).toString('hex'),
      verificationStatus: 'pending',
      sslStatus: cloudflare?.ssl?.status === 'active' ? 'active' : 'pending',
      cloudflareHostnameId: cloudflare?.id,
      createdAt: now,
      updatedAt: now
    };
    await saveDomain({ ...domain, dnsRecords: domainDnsRecords(cloudflare) });
    await publicCache.delete(cacheKey('domainResolution', hostname));
    return res.status(201).json({ domain, dnsRecords: domainDnsRecords(cloudflare) });
  } catch (error) {
    if (error instanceof Error && error.message === 'DOMAIN_ALREADY_RESERVED') {
      return res.status(409).json({ error: 'Domain is already attached' });
    }
    if (reservedDomainId) {
      await adminDb.collection('custom_domains').doc(reservedDomainId).set({
        verificationStatus: 'failed',
        sslStatus: 'failed',
        lastError: 'Cloudflare could not provision this domain',
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(() => undefined);
    }
    console.error('[Domain provision]', error);
    return res.status(502).json({ error: 'Cloudflare could not provision this domain' });
  }
});

app.post('/api/domains/verify', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  if (!isAdminConfigured() || !getCloudflareConfig()) return res.status(503).json({ error: 'Domain verification is not configured' });

  const domainId = typeof req.body?.domainId === 'string' ? req.body.domainId : '';
  const domain = await findDomainById(domainId);
  if (!domain || domain.userId !== user.uid) return res.status(404).json({ error: 'Domain not found' });
  if (!(await getOwnedSite(user.uid, domain.siteId))) return res.status(404).json({ error: 'Domain site not found' });
  if (!domain.cloudflareHostnameId) return res.status(409).json({ error: 'Cloudflare hostname is missing' });
  const domainRate = await enforceRateLimitPolicy('domainVerification', { ip: clientIdentity(req), user: user.uid, site: domain.siteId, domain: domainId });
  if (!domainRate.allowed) return res.status(429).set('Retry-After', String(domainRate.retryAfter)).json({ error: 'Too many domain verification attempts', retry_after: domainRate.retryAfter });

  try {
    const config = getCloudflareConfig()!;
    const { cloudflareRequest } = await import('./server-services');
    const result = await cloudflareRequest(`/zones/${config.zoneId}/custom_hostnames/${domain.cloudflareHostnameId}`);
    const verificationStatus = result?.status === 'active' ? 'verified' : result?.status === 'failed' ? 'failed' : 'pending';
    const sslStatus = result?.ssl?.status === 'active' ? 'active' : result?.ssl?.status === 'failed' ? 'failed' : 'pending';
    const updated: DomainRecord = {
      ...domain,
      verificationStatus,
      sslStatus,
      lastError: verificationStatus === 'failed' || sslStatus === 'failed' ? 'Cloudflare reported a failed DNS or SSL state' : undefined,
      updatedAt: new Date().toISOString()
    };
    await saveDomain(updated);
    await publicCache.delete(cacheKey('domainResolution', String(domain.hostname || '').toLowerCase()));
    return res.status(200).json({ domain: updated });
  } catch (error) {
    await saveDomain({
      ...domain,
      verificationStatus: 'failed',
      sslStatus: 'failed',
      lastError: 'Cloudflare verification failed',
      updatedAt: new Date().toISOString()
    }).catch(() => undefined);
    console.error('[Domain verify]', error);
    return res.status(502).json({ error: 'Cloudflare verification failed' });
  }
});

app.delete('/api/domains/:domainId', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  if (!isAdminConfigured()) return res.status(503).json({ error: 'Domain deletion is not configured' });
  const domain = await findDomainById(req.params.domainId);
  if (!domain || domain.userId !== user.uid) return res.status(404).json({ error: 'Domain not found' });
  if (!(await getOwnedSite(user.uid, domain.siteId))) return res.status(404).json({ error: 'Domain site not found' });

  try {
    const config = getCloudflareConfig();
    if (config && domain.cloudflareHostnameId) {
      await cloudflareRequest(`/zones/${config.zoneId}/custom_hostnames/${domain.cloudflareHostnameId}`, { method: 'DELETE' });
    }
    await deleteDomain(domain.domainId);
    await publicCache.delete(cacheKey('domainResolution', String(domain.hostname || '').toLowerCase()));
    return res.status(204).send();
  } catch (error) {
    console.error('[Domain delete]', error);
    return res.status(502).json({ error: 'Domain could not be removed' });
  }
});

/**
 * Serve static production assets from dist directory
 */
const distPath = path.resolve(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  }));
}

/**
 * FR-1.4 Public Handle Rewriting & FR-3.1/FR-3.2 SSR Meta Tag Hydration
 */
app.get('*', async (req: Request, res: Response) => {
  // The HTML shell contains the current hashed asset manifest. Never let a
  // browser keep an old shell after a deployment replaces those chunks.
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  let html = getIndexHtml();
  const requestPath = req.path;
  const customOrigin = canonicalOrigin(req);
  const platformPath = requestPath === '/' ? '' : requestPath;
  let isPublicProfile = false;

  // Guard: Authenticated users should never see not-logged-in guest auth routes
  const session = await getAuthenticatedUser(req);
  const isSessionValid = Boolean(session);

  if (isSessionValid) {
    if (
      requestPath === '/login' ||
      requestPath === '/register' ||
      requestPath === '/forgot-password' ||
      requestPath === '/reset-password'
    ) {
      return res.redirect(302, '/');
    }
  }

  // Handle public creator routes: /@handle or /public-render/handle
  const handleMatch = requestPath.match(/^\/(?:@|public-render\/)([a-zA-Z0-9._-]+)$/);
  if (handleMatch) {
    const handle = handleMatch[1].toLowerCase();
    const customDomainSite = (req as Request & { customDomainSite?: Record<string, unknown> }).customDomainSite;
    let publicSiteLookupFailed = false;
    let publishedSite: Record<string, unknown> | null | undefined = customDomainSite;
    if (!publishedSite && isAdminConfigured()) {
      try {
        publishedSite = await getPublishedSiteByHandle(handle);
        if (!publishedSite && !customDomainSite) {
          const redirect = await resolveSiteSlugRedirect(handle);
          if (redirect?.canonicalSlug && redirect.canonicalSlug !== handle) {
            const target = await getPublishedSiteByHandle(redirect.canonicalSlug);
            if (target) return res.redirect(308, `/@${redirect.canonicalSlug}`);
          }
        }
      } catch (error) {
        publicSiteLookupFailed = true;
        console.error('[Public SSR profile lookup]', error);
      }
    }
    const fixtureCreator = publicDemoFixturesEnabled ? CREATORS_METADATA[handle] : undefined;
    const creator = publishedSite
      ? {
          name: String(publishedSite.displayName || handle),
          avatar: String(publishedSite.avatar || ''),
          bio: String(publishedSite.bio || ''),
          role: String(publishedSite.role || ''),
          metaTitle: typeof publishedSite.metaTitle === 'string' ? publishedSite.metaTitle.trim().slice(0, 160) : '',
          metaDescription: typeof publishedSite.metaDescription === 'string' ? publishedSite.metaDescription.trim().slice(0, 320) : ''
        }
      : fixtureCreator;

    if (creator) {
      isPublicProfile = true;
      res.set({ 'Cache-Control': publicCreatorAdapter.cacheControl, Vary: 'Host' });
      // Dynamic OpenGraph & Twitter hydration (FR-3.2)
      const profileTitle = 'metaTitle' in creator && creator.metaTitle ? creator.metaTitle : `${creator.name} (@${handle}) - RALOA Mini-Site`;
      const profileDescription = 'metaDescription' in creator && creator.metaDescription ? creator.metaDescription : creator.bio || `Explore ${creator.name}'s official links and work on RALOA.`;
      const ogTitle = escapeHtml(profileTitle);
      const ogDesc = escapeHtml(profileDescription);
      const ogImage = escapeHtml(creator.avatar || 'https://raloa.app/social/og-image-1200x630.jpg');
      const profileCanonical = customOrigin === 'https://raloa.app' ? `https://raloa.app/@${handle}` : `${customOrigin}/`;

      html = html
        .replace(/<link rel="alternate" hreflang=".*?" href=".*?" \/>\s*/g, '')
        .replace(/<title>.*?<\/title>/, `<title>${ogTitle}</title>`)
        .replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${escapeHtml(profileDescription)}" />`)
        .replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${ogTitle}" />`)
        .replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${ogDesc}" />`)
        .replace(/<meta property="og:image" content=".*?" \/>/, `<meta property="og:image" content="${ogImage}" />`)
        .replace(/<meta property="og:url" content=".*?" \/>/, `<meta property="og:url" content="${escapeHtml(profileCanonical)}" />`)
        .replace(/<link rel="canonical" href=".*?" \/>/, `<link rel="canonical" href="${escapeHtml(profileCanonical)}" />`)
        .replace(/<meta name="twitter:title" content=".*?" \/>/, `<meta name="twitter:title" content="${ogTitle}" />`)
        .replace(/<meta name="twitter:description" content=".*?" \/>/, `<meta name="twitter:description" content="${ogDesc}" />`)
        .replace(/<meta name="twitter:image" content=".*?" \/>/, `<meta name="twitter:image" content="${ogImage}" />`);
      const allowSearchIndexing = publishedSite?.searchIndexing !== false;
      html = setRobotsMetadata(html, allowSearchIndexing ? 'index, follow' : 'noindex, nofollow');
      if (!allowSearchIndexing) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      html = injectJsonLd(html, {
        '@context': 'https://schema.org',
        '@type': 'ProfilePage',
        '@id': `${profileCanonical}#profile`,
        url: profileCanonical,
        name: `${creator.name} on RALOA`,
        mainEntity: {
          '@type': 'Person',
          name: creator.name,
          description: profileDescription,
          jobTitle: creator.role || undefined,
          image: creator.avatar || undefined,
          url: profileCanonical
        },
        isPartOf: { '@id': 'https://raloa.app/#website' }
      });
    } else {
      const unavailable = publicSiteLookupFailed || (!isAdminConfigured() && !publicDemoFixturesEnabled);
      const notFoundTitle = unavailable
        ? `503: Profile temporarily unavailable - RALOA`
        : `404: Handle @${handle} Not Found - RALOA`;
      html = setRobotsMetadata(html.replace(/<title>.*?<\/title>/, `<title>${notFoundTitle}</title>`), 'noindex, nofollow');
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      return res.status(unavailable ? 503 : 404).send(html);
    }
  } else if (requestPath === '/templates') {
    html = html
      .replace(/<title>.*?<\/title>/, '<title>All Templates — RALOA Design Gallery</title>')
      .replace(/<meta property="og:title" content=".*?" \/>/, '<meta property="og:title" content="Explore All Mini-Site Templates - RALOA" />');
  } else if (requestPath === '/pricing') {
    html = html
      .replace(/<title>.*?<\/title>/, '<title>Pricing Plans - RALOA</title>')
      .replace(/<meta property="og:title" content=".*?" \/>/, '<meta property="og:title" content="Transparent Pricing Plans - Free & Pro | RALOA" />');
  } else if (requestPath === '/features') {
    html = html
      .replace(/<title>.*?<\/title>/, '<title>Creator Toolkit & Features - RALOA</title>')
      .replace(/<meta property="og:title" content=".*?" \/>/, '<meta property="og:title" content="All-in-One Creator Toolkit - RALOA" />');
  } else if (requestPath === '/guides') {
    html = html
      .replace(/<title>.*?<\/title>/, '<title>Guides & Tutorials - RALOA</title>')
      .replace(/<meta property="og:title" content=".*?" \/>/, '<meta property="og:title" content="Platform Guides and Creator Tutorials - RALOA" />');
  } else if (requestPath === '/about') {
    html = html
      .replace(/<title>.*?<\/title>/, '<title>About Us - RALOA</title>')
      .replace(/<meta property="og:title" content=".*?" \/>/, '<meta property="og:title" content="Our Story and Mission - RALOA" />');
  } else if (requestPath === '/contact') {
    html = html
      .replace(/<title>.*?<\/title>/, '<title>Contact Support - RALOA</title>')
      .replace(/<meta property="og:title" content=".*?" \/>/, '<meta property="og:title" content="Contact RALOA Support & Partnerships" />');
  } else if (requestPath.startsWith('/legal/')) {
    const docName = requestPath.replace('/legal/', '').replace(/-/g, ' ');
    const capitalized = docName.charAt(0).toUpperCase() + docName.slice(1);
    html = html
      .replace(/<title>.*?<\/title>/, `<title>${capitalized} - RALOA Legal</title>`)
      .replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${capitalized} - RALOA Legal Terms" />`);
  } else if (requestPath === '/login') {
    html = html
      .replace(/<title>.*?<\/title>/, '<title>Sign In - RALOA</title>')
      .replace(/<meta property="og:title" content=".*?" \/>/, '<meta property="og:title" content="Sign In to RALOA Studio" />');
  } else if (requestPath === '/register') {
    html = html
      .replace(/<title>.*?<\/title>/, '<title>Create Your Account - RALOA</title>')
      .replace(/<meta property="og:title" content=".*?" \/>/, '<meta property="og:title" content="Claim Your Handle & Start Building - RALOA" />');
  }

  const routeSeo: Record<string, { description: string; canonical: string }> = {
    '/': {
      description: 'Create a polished mini-site for your links, content, bookings and products. Launch in minutes with RALOA - no coding required.',
      canonical: 'https://raloa.app/'
    },
    '/templates': {
      description: 'Explore curated mini-site templates for creators, photographers, educators, coaches, and modern businesses.',
      canonical: 'https://raloa.app/templates'
    },
    '/features': {
      description: 'See RALOA tools for customizable mini-sites, links, media, publishing, analytics, and Arabic RTL support.',
      canonical: 'https://raloa.app/features'
    },
    '/pricing': {
      description: 'Compare RALOA Free, Pro, and Studio plans with clear monthly pricing and verified feature limits.',
      canonical: 'https://raloa.app/pricing'
    },
    '/guides': {
      description: 'Learn how to create, customize, publish, and share a RALOA mini-site with practical creator guides.',
      canonical: 'https://raloa.app/guides'
    },
    '/about': {
      description: 'Learn what RALOA does and how its no-code mini-site builder serves creators, freelancers, and businesses.',
      canonical: 'https://raloa.app/about'
    },
    '/contact': {
      description: 'Contact RALOA for product support, partnerships, and questions about creating your mini-site.',
      canonical: 'https://raloa.app/contact'
    }
  };
  const selectedSeo = routeSeo[requestPath];
  if (selectedSeo) {
    const canonical = customOrigin === 'https://raloa.app'
      ? selectedSeo.canonical
      : `${customOrigin}/`;
    html = html
      .replace(/<link rel="alternate" hreflang=".*?" href=".*?" \/>\s*/g, '')
      .replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${escapeHtml(selectedSeo.description)}" />`)
      .replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${escapeHtml(selectedSeo.description)}" />`)
      .replace(/<meta property="og:url" content=".*?" \/>/, `<meta property="og:url" content="${escapeHtml(canonical)}" />`)
      .replace(/<link rel="canonical" href=".*?" \/>/, `<link rel="canonical" href="${escapeHtml(canonical)}" />`);
    const seoPage = SEO_PAGES[requestPath];
    if (seoPage) html = injectSeoPageContent(html, seoPage, requestPath);
    html = injectJsonLd(html, {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: seoPage?.title || 'RALOA',
      description: selectedSeo.description,
      url: canonical,
      isPartOf: { '@id': 'https://raloa.app/#website' }
    });
    html = html.replace('</head>', `<link rel="alternate" hreflang="en" href="https://raloa.app${platformPath || '/'}" /><link rel="alternate" hreflang="ar" href="https://raloa.app/ar${platformPath || ''}" /><link rel="alternate" hreflang="x-default" href="https://raloa.app${platformPath || '/'}" /></head>`);
  } else {
    const noIndexRoutes = new Set(['/login', '/register', '/forgot-password', '/reset-password', '/dashboard', '/studio', '/analytics', '/settings']);
    if (isPublicProfile) {
      html = setRobotsMetadata(html, 'index, follow');
    } else {
      html = setRobotsMetadata(html, 'noindex, nofollow')
        .replace(/<link rel="canonical" href=".*?" \/>/, `<link rel="canonical" href="${escapeHtml(`${customOrigin}${requestPath}`)}" />`)
        .replace(/<meta property="og:url" content=".*?" \/>/, `<meta property="og:url" content="${escapeHtml(`${customOrigin}${requestPath}`)}" />`);
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      if (!noIndexRoutes.has(requestPath) && !requestPath.startsWith('/legal/')) {
        return res.status(404).send(html);
      }
    }
  }

  return res.status(200).send(html);
});

app.post('/internal/background-jobs/run', async (req: Request, res: Response) => {
  const configuredSecret = process.env.BACKGROUND_JOB_SECRET;
  const providedSecret = req.headers['x-background-job-secret'];
  if (!configuredSecret || providedSecret !== configuredSecret) return res.status(401).json({ error: 'UNAUTHORIZED' });
  const jobId = typeof req.body?.jobId === 'string' ? req.body.jobId : '';
  if (!jobId) return res.status(400).json({ error: 'JOB_ID_REQUIRED' });
  try {
    await backgroundJobs.run(jobId);
    return res.status(202).json({ accepted: true, jobId });
  } catch (error) {
    console.error('[Background job worker]', error);
    return res.status(500).json({ error: 'JOB_PROCESSING_FAILED' });
  }
});

app.post('/internal/background-jobs/reconcile', async (req: Request, res: Response) => {
  const configuredSecret = process.env.BACKGROUND_JOB_SECRET;
  if (!configuredSecret || req.headers['x-background-job-secret'] !== configuredSecret) return res.status(401).json({ error: 'UNAUTHORIZED' });
  const limit = Math.min(500, Math.max(1, Number(req.body?.limit) || 100));
  const result = await backgroundJobs.reconcile(limit);
  return res.status(200).json(result);
});

app.post('/internal/outbox/publish', async (req: Request, res: Response) => {
  const configuredSecret = process.env.BACKGROUND_JOB_SECRET;
  if (!configuredSecret || req.headers['x-background-job-secret'] !== configuredSecret) return res.status(401).json({ error: 'UNAUTHORIZED' });
  const limit = Math.min(500, Math.max(1, Number(req.body?.limit) || 100));
  return res.status(200).json(await outbox.publishPending(limit));
});

app.use((error: Error, req: Request, res: Response, _next: NextFunction) => {
  const requestId = res.getHeader('X-Request-ID');
  console.error(JSON.stringify({
    requestId,
    method: req.method,
    path: req.path,
    error: error.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
  }));
  if (res.headersSent) return;
  res.status(500).json({ status: 'error', error: 'INTERNAL_ERROR', code: 'INTERNAL_ERROR', message: 'Internal server error', requestId });
});

// Start listening if run directly
const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectExecution && process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[RALOA Edge Proxy] Listening on http://0.0.0.0:${PORT}`);
  });
}

export default app;
