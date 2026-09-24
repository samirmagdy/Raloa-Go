import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { DocumentData } from 'firebase-admin/firestore';
import {
  APP_URL,
  adminDb,
  cloudflareRequest,
  createCheckoutSession,
  createPortalSession,
  deleteDomain,
  findDomainByHostname,
  findDomainById,
  getCheckoutSessionStatus,
  getPublishedSiteByHandle,
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT) || 3000;
const AUTH_SESSION_SECRET = process.env.AUTH_SESSION_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'local-development-session-secret');

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

// Seeded user database with verified creator account (FR-4.1)
export const USERS_DB: Record<string, UserAccount> = {
  'creator@example.com': {
    id: 'usr_9bf7cf1a80c',
    email: 'creator@example.com',
    passwordHash: hashPassword('SecurePassword123!', DEFAULT_SALT),
    salt: DEFAULT_SALT,
    primary_handle: 'creator',
    email_verified: true,
  },
};

const USERS_CACHE_FILE = path.join(__dirname, '.local_users_cache.json');
try {
  if (fs.existsSync(USERS_CACHE_FILE)) {
    const raw = fs.readFileSync(USERS_CACHE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    Object.assign(USERS_DB, parsed);
  }
} catch (_) {}

// Ensure creator@example.com is always verified with SecurePassword123!
USERS_DB['creator@example.com'] = {
  id: 'usr_9bf7cf1a80c',
  email: 'creator@example.com',
  passwordHash: hashPassword('SecurePassword123!', DEFAULT_SALT),
  salt: DEFAULT_SALT,
  primary_handle: 'creator',
  email_verified: true,
};

export function persistUsersCache() {
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
    return verifySignedSessionCookie(sessionToken);
  }
  const session = sessionToken ? ACTIVE_SESSIONS.get(sessionToken) : undefined;
  return session && session.expiresAt > Date.now()
    ? { uid: session.userId, email: session.email }
    : null;
}

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

function hasPaidPlan(profile: DocumentData | undefined): boolean {
  if (!profile || !['pro', 'studio'].includes(profile.plan)) return false;
  return !(profile.plan === 'pro' && profile.referralProUntil && Date.parse(profile.referralProUntil) <= Date.now());
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

function createSignedSessionCookie(user: AuthenticatedUser, primaryHandle: string): string {
  if (!AUTH_SESSION_SECRET) throw new Error('AUTH_SESSION_SECRET_NOT_CONFIGURED');
  const payload = Buffer.from(JSON.stringify({
    uid: user.uid,
    email: user.email || '',
    primary_handle: primaryHandle,
    expiresAt: Date.now() + 604800000
  })).toString('base64url');
  return `${payload}.${signSessionPayload(payload)}`;
}

function verifySignedSessionCookie(token: string): AuthenticatedUser & { primary_handle: string } | null {
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
      expiresAt?: number;
    };
    if (!parsed.uid || !parsed.expiresAt || parsed.expiresAt <= Date.now()) return null;
    return {
      uid: parsed.uid,
      email: parsed.email,
      primary_handle: parsed.primary_handle || parsed.email?.split('@')[0] || 'creator'
    };
  } catch {
    return null;
  }
}

function getRequestHost(req: Request): string {
  const forwardedHost = req.headers['x-forwarded-host'];
  if (typeof forwardedHost === 'string' && forwardedHost.trim()) {
    return forwardedHost.split(',')[0].trim().toLowerCase();
  }
  return (req.headers.host || '').split(':')[0].toLowerCase();
}

/**
 * FR-1.1 Canonical Apex Redirect Middleware
 * All requests hitting http://* or https://www.raloa.app must resolve with a 301 Permanent Redirect to https://raloa.app/.
 */
app.use((req: Request, res: Response, next: NextFunction) => {
  const host = getRequestHost(req);
  const forwardedProto = req.headers['x-forwarded-proto'];

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
  const profiles: Array<{ handle: string; lastmod: string | null }> = Object.entries(CREATORS_METADATA).map(([handle]) => ({ handle, lastmod: null }));

  // In production, only published sites are eligible for discovery. The fixture
  // catalog is retained for local/demo mode so the sitemap remains useful there.
  if (isAdminConfigured()) {
    try {
      const snapshot = await adminDb.collectionGroup('sites').where('isPublished', '==', true).get();
      const publishedHandles = new Map<string, { handle: string; lastmod: string | null }>();
      for (const document of snapshot.docs) {
        const data = document.data();
        const handle = String(data.handle || data.username || '').toLowerCase().trim();
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
    ? await findDomainByHostname(host)
    : CUSTOM_DOMAINS[host];
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

  // Active custom domain: rewrite internally to public-render without URL path pollution
  const siteId = 'siteId' in mapping ? mapping.siteId : mapping.site_id;
  req.url = `/@${siteId}`;
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
    if (!session) {
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
  const isExistingCreator = !!CREATORS_METADATA[clean];
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
    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reservationRef);
      if (snapshot.exists && snapshot.data()?.userId !== user.uid) throw new Error('HANDLE_TAKEN');
      transaction.set(reservationRef, { userId: user.uid, handle, updatedAt: new Date().toISOString() }, { merge: true });
    });
    await adminDb.collection('users').doc(user.uid).set({ handle, updatedAt: new Date().toISOString() }, { merge: true });
    return res.status(200).json({ handle });
  } catch (error) {
    if (error instanceof Error && error.message === 'HANDLE_TAKEN') return res.status(409).json({ error: 'Handle is already taken' });
    console.error('[Handle reservation]', error);
    return res.status(503).json({ error: 'Handle reservation is temporarily unavailable' });
  }
});

app.post('/api/v1/public/bookings', async (req: Request, res: Response) => {
  const hostHandle = typeof req.body?.hostHandle === 'string' ? req.body.hostHandle.trim().toLowerCase() : '';
  const date = typeof req.body?.date === 'string' ? req.body.date : '';
  const timeSlot = typeof req.body?.timeSlot === 'string' ? req.body.timeSlot.trim() : '';
  const clientEmail = typeof req.body?.clientEmail === 'string' ? req.body.clientEmail.trim().toLowerCase() : '';
  if (!/^[a-z0-9_-]{3,30}$/.test(hostHandle) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !timeSlot || !validEmail(clientEmail)) {
    return res.status(400).json({ error: 'Valid host, date, time, and email are required' });
  }
  try {
    const booking = { hostHandle, date, timeSlot, clientEmail, status: 'pending', createdAt: new Date().toISOString() };
    const reference = isAdminConfigured()
      ? await adminDb.collection('bookings').add(booking)
      : { id: `booking_${Date.now()}` };
    return res.status(201).json({ id: reference.id, status: booking.status });
  } catch (error) {
    console.error('[Public booking]', error);
    return res.status(503).json({ error: 'Booking service is temporarily unavailable' });
  }
});

app.post('/api/v1/public/orders', async (req: Request, res: Response) => {
  const itemTitle = typeof req.body?.itemTitle === 'string' ? req.body.itemTitle.trim() : '';
  const buyerEmail = typeof req.body?.buyerEmail === 'string' ? req.body.buyerEmail.trim().toLowerCase() : '';
  if (itemTitle !== 'Brutalist Shadow Study #03' || !validEmail(buyerEmail)) {
    return res.status(400).json({ error: 'A valid product and buyer email are required' });
  }
  try {
    const order = { itemTitle, price: 140, currency: 'USD', buyerEmail, status: 'pending', createdAt: new Date().toISOString() };
    const reference = isAdminConfigured()
      ? await adminDb.collection('orders').add(order)
      : { id: `order_${Date.now()}` };
    return res.status(201).json({ id: reference.id, status: order.status });
  } catch (error) {
    console.error('[Public order]', error);
    return res.status(503).json({ error: 'Order service is temporarily unavailable' });
  }
});

app.post('/api/v1/public/newsletter', async (req: Request, res: Response) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!validEmail(email)) return res.status(400).json({ error: 'A valid email is required' });
  try {
    const subscriber = { email, createdAt: new Date().toISOString() };
    const reference = isAdminConfigured()
      ? await adminDb.collection('newsletter_subscribers').add(subscriber)
      : { id: `subscriber_${Date.now()}` };
    return res.status(201).json({ id: reference.id });
  } catch (error) {
    console.error('[Newsletter signup]', error);
    return res.status(503).json({ error: 'Newsletter service is temporarily unavailable' });
  }
});

/**
 * FR-2.4 Contact Form Ingestion Endpoint
 * Rate-limited via IP bucket: Max 5 submissions per hour per IP.
 * Validates required payload fields: fullName, email, subject, message.
 */
app.post('/api/v1/public/contact', async (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();
  const oneHourAgo = now - 3600000;

  // Rate limit: Max 5 submissions per hour per IP (FR-2.4)
  const timestamps = (CONTACT_RATE_LIMITS.get(ip) || []).filter((t) => t > oneHourAgo);
  const distributedLimit = await consumeDistributedRateLimit(`contact:${ip}`, 5, 3600000);
  if ((!isAdminConfigured() && timestamps.length >= 5) || (isAdminConfigured() && !distributedLimit.allowed)) {
    return res.status(429).json({
      status: 'error',
      error: 'Too Many Requests',
      message: 'Rate limit exceeded: maximum 5 contact inquiries per hour per IP.',
      retry_after: distributedLimit.retryAfter || 3600
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

/**
 * FR-4.1 User Registration Endpoint (Localhost & Server Auth)
 * Supports localhost registration when Firebase Cloud provider is restricted.
 */
app.post('/api/v1/auth/register', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
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
  if (process.env.NODE_ENV === 'production') {
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
      const distributedLimit = await consumeDistributedRateLimit(`login:${rateLimitKey}`, 5, 600000);
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
app.post('/api/v1/auth/logout', (req: Request, res: Response) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies['raloa_session'];

  if (sessionToken) {
    ACTIVE_SESSIONS.delete(sessionToken);
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
  if (process.env.NODE_ENV === 'production') {
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
  const distributedLimit = await consumeDistributedRateLimit(`password-reset:${rateKey}`, 3, 900000);
  if ((!isAdminConfigured() && timestamps.length >= 3) || (isAdminConfigured() && !distributedLimit.allowed)) {
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
  if (process.env.NODE_ENV === 'production') {
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
  if (process.env.NODE_ENV === 'production') {
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
  if (process.env.NODE_ENV === 'production') {
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
    const cookie = createSignedSessionCookie(user, user.email?.split('@')[0] || 'creator');
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
 * FR-4.5 Email Verification Confirmation
 */
app.post('/api/v1/auth/verify-email', (req: Request, res: Response) => {
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

app.get('/api/public/sites/:handle', async (req: Request, res: Response) => {
  const handle = String(req.params.handle || '').trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,30}$/.test(handle)) return res.status(400).json({ error: 'Invalid handle' });

  try {
    const site = isAdminConfigured() ? await getPublishedSiteByHandle(handle) : null;
    if (site) return res.status(200).json({ site });

    const fixture = templatesData.find((template) => template.id.toLowerCase() === handle || template.name.toLowerCase() === handle);
    if (!fixture) return res.status(404).json({ error: 'Published site not found' });
    return res.status(200).json({
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
  } catch (error) {
    console.error('[Public site lookup]', error);
    return res.status(503).json({ error: 'Public site is temporarily unavailable' });
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
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  const plan = req.body?.plan === 'studio' || req.body?.plan === 'business' ? 'studio' : req.body?.plan;
  const isYearly = req.body?.isYearly === true;
  if (plan !== 'pro' && plan !== 'studio') return res.status(400).json({ error: 'A paid plan is required' });

  try {
    const idempotencyKey = typeof req.headers['idempotency-key'] === 'string'
      ? req.headers['idempotency-key']
      : undefined;
    const url = await createCheckoutSession(user, plan, isYearly, idempotencyKey);
    return res.status(200).json({ url });
  } catch (error) {
    console.error('[Billing checkout]', error);
    const message = error instanceof Error ? error.message : 'Checkout unavailable';
    return res.status(message.includes('NOT_CONFIGURED') ? 503 : 500).json({ error: message });
  }
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
    const codeSnapshot = await adminDb.collection('referral_codes').doc(code).get();
    if (!codeSnapshot.exists) return res.status(404).json({ error: 'Referral code not found' });
    const referrerId = codeSnapshot.data()?.userId;
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
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  try {
    return res.status(200).json({ url: await createPortalSession(user.uid) });
  } catch (error) {
    console.error('[Billing portal]', error);
    const message = error instanceof Error ? error.message : 'Billing portal unavailable';
    return res.status(message.includes('NOT_FOUND') ? 404 : 503).json({ error: message });
  }
});

app.get('/api/domains', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  if (!isAdminConfigured()) return res.status(200).json({ domains: [] });

  const snapshot = await adminDb.collection('custom_domains').where('userId', '==', user.uid).get();
  return res.status(200).json({ domains: snapshot.docs.map((document) => document.data()) });
});

app.post('/api/domains/provision', async (req: Request, res: Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  if (!isAdminConfigured() || !getCloudflareConfig()) return res.status(503).json({ error: 'Domain provisioning is not configured' });

  const hostname = normalizeHostname(req.body?.hostname);
  const siteId = typeof req.body?.siteId === 'string' ? req.body.siteId.trim() : 'default';
  if (!hostname) return res.status(400).json({ error: 'A valid customer-owned hostname is required' });

  const userProfile = await adminDb.collection('users').doc(user.uid).get();
  if (!hasPaidPlan(userProfile.data())) return res.status(403).json({ error: 'Custom domains require a paid plan' });

  const siteSnapshot = await adminDb.collection('users').doc(user.uid).collection('sites').doc(siteId).get();
  if (!siteSnapshot.exists) return res.status(404).json({ error: 'Site not found' });
  if (siteSnapshot.data()?.isPublished !== true) return res.status(409).json({ error: 'Publish the site before attaching a domain' });

  const existing = await findDomainByHostname(hostname);
  if (existing && existing.userId !== user.uid) return res.status(409).json({ error: 'Domain is already attached' });
  if (existing) return res.status(200).json({ domain: existing });

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
          custom_metadata: { raloaDomainId: domainId, userId: user.uid, siteId },
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
      verificationToken: crypto.randomBytes(24).toString('hex'),
      verificationStatus: 'pending',
      sslStatus: cloudflare?.ssl?.status === 'active' ? 'active' : 'pending',
      cloudflareHostnameId: cloudflare?.id,
      createdAt: now,
      updatedAt: now
    };
    await saveDomain({ ...domain, dnsRecords: domainDnsRecords(cloudflare) });
    return res.status(201).json({ domain, dnsRecords: domainDnsRecords(cloudflare) });
  } catch (error) {
    if (error instanceof Error && error.message === 'DOMAIN_ALREADY_RESERVED') {
      return res.status(409).json({ error: 'Domain is already attached' });
    }
    if (reservedDomainId) await adminDb.collection('custom_domains').doc(reservedDomainId).delete().catch(() => undefined);
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
  if (!domain.cloudflareHostnameId) return res.status(409).json({ error: 'Cloudflare hostname is missing' });

  try {
    const config = getCloudflareConfig()!;
    const { cloudflareRequest } = await import('./server-services');
    const result = await cloudflareRequest(`/zones/${config.zoneId}/custom_hostnames/${domain.cloudflareHostnameId}`);
    const updated: DomainRecord = {
      ...domain,
      verificationStatus: result?.status === 'active' ? 'verified' : 'pending',
      sslStatus: result?.ssl?.status === 'active' ? 'active' : 'pending',
      updatedAt: new Date().toISOString()
    };
    await saveDomain(updated);
    return res.status(200).json({ domain: updated });
  } catch (error) {
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

  try {
    const config = getCloudflareConfig();
    if (config && domain.cloudflareHostnameId) {
      await cloudflareRequest(`/zones/${config.zoneId}/custom_hostnames/${domain.cloudflareHostnameId}`, { method: 'DELETE' });
    }
    await deleteDomain(domain.domainId);
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
  app.use(express.static(distPath, { index: false }));
}

/**
 * FR-1.4 Public Handle Rewriting & FR-3.1/FR-3.2 SSR Meta Tag Hydration
 */
app.get('*', async (req: Request, res: Response) => {
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
    const publishedSite = isAdminConfigured() ? await getPublishedSiteByHandle(handle).catch(() => null) : null;
    const fixtureCreator = CREATORS_METADATA[handle];
    const creator = publishedSite
      ? {
          name: String(publishedSite.displayName || handle),
          avatar: String(publishedSite.avatar || ''),
          bio: String(publishedSite.bio || ''),
          role: String(publishedSite.role || '')
        }
      : fixtureCreator;

    if (creator) {
      isPublicProfile = true;
      // Dynamic OpenGraph & Twitter hydration (FR-3.2)
      const ogTitle = escapeHtml(`${creator.name} (@${handle}) - RALOA Mini-Site`);
      const ogDesc = escapeHtml(creator.bio);
      const ogImage = escapeHtml(creator.avatar);
      const profileCanonical = customOrigin === 'https://raloa.app' ? `https://raloa.app/@${handle}` : `${customOrigin}/`;
      const profileDescription = creator.bio || `Explore ${creator.name}'s official links and work on RALOA.`;

      html = html
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
      html = setRobotsMetadata(html, 'index, follow');
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
      // AC-03: Invalid handle 404 metadata
      const notFoundTitle = `404: Handle @${handle} Not Found - RALOA`;
      html = setRobotsMetadata(html.replace(/<title>.*?<\/title>/, `<title>${notFoundTitle}</title>`), 'noindex, nofollow');
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      return res.status(404).send(html);
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
      .replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${escapeHtml(selectedSeo.description)}" />`)
      .replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${escapeHtml(selectedSeo.description)}" />`)
      .replace(/<meta property="og:url" content=".*?" \/>/, `<meta property="og:url" content="${escapeHtml(canonical)}" />`)
      .replace(/<link rel="canonical" href=".*?" \/>/, `<link rel="canonical" href="${escapeHtml(canonical)}" />`);
    const seoPage = SEO_PAGES[requestPath];
    if (seoPage) html = injectSeoPageContent(html, seoPage, requestPath);
    html = injectJsonLd(html, {
      '@context': 'https://schema.org',
      '@type': requestPath === '/' ? 'WebSite' : 'WebPage',
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
  res.status(500).json({ error: 'Internal server error', requestId });
});

// Start listening if run directly
const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectExecution && process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[RALOA Edge Proxy] Listening on http://0.0.0.0:${PORT}`);
  });
}

export default app;
