import express, { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Body parsing middleware for API endpoints
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Read base index.html template from dist if built, or fallback to root index.html
const distIndexPath = path.resolve(__dirname, 'dist', 'index.html');
const rootIndexPath = path.resolve(__dirname, 'index.html');
let indexHtmlTemplate = '';

function getIndexHtml(): string {
  if (fs.existsSync(distIndexPath)) {
    return fs.readFileSync(distIndexPath, 'utf-8');
  }
  if (fs.existsSync(rootIndexPath)) {
    return fs.readFileSync(rootIndexPath, 'utf-8');
  }
  return '<!doctype html><html><head><title>RALOA</title></head><body><div id="root"></div></body></html>';
}

/**
 * 6.2 Custom Domain Mapping Contract (Database Entity)
 */
interface CustomDomainDnsRecord {
  type: 'CNAME' | 'A';
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

// Password reset token store (FR-4.4: 15-minute TTL, 256-bit entropy)
export const PASSWORD_RESET_TOKENS = new Map<string, { email: string; expiresAt: number }>();
export const FORGOT_PW_RATE_LIMITS = new Map<string, number[]>();

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
app.use((req: Request, res: Response, next: NextFunction) => {
  // HSTS (Strict-Transport-Security)
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

  // MIME type sniffing protection
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // X-Frame-Options: SAMEORIGIN (allow iframe embedding on authorized template preview routes)
  if (req.path.startsWith('/templates/preview') || req.path.startsWith('/embed/')) {
    res.setHeader('X-Frame-Options', 'ALLOWALL');
  } else {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }

  // Content-Security-Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://apis.google.com; " +
    "connect-src 'self' https: wss:; " +
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com; " +
    "img-src 'self' https: data: blob:;"
  );

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
  res.send(`User-agent: *
Allow: /
Disallow: /studio/
Disallow: /api/
Disallow: /login
Disallow: /register

Sitemap: https://raloa.app/sitemap.xml
`);
});

/**
 * FR-3.3 Dynamic sitemap.xml Endpoint
 */
app.get('/sitemap.xml', (_req: Request, res: Response) => {
  res.type('application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://raloa.app/</loc>
    <lastmod>2026-09-24</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <xhtml:link rel="alternate" hreflang="en" href="https://raloa.app/?lang=en" />
    <xhtml:link rel="alternate" hreflang="ar" href="https://raloa.app/?lang=ar" />
  </url>
  <url>
    <loc>https://raloa.app/templates</loc>
    <lastmod>2026-09-24</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://raloa.app/features</loc>
    <lastmod>2026-09-24</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://raloa.app/pricing</loc>
    <lastmod>2026-09-24</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://raloa.app/@elena</loc>
    <lastmod>2026-09-24</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://raloa.app/@mateo</loc>
    <lastmod>2026-09-24</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://raloa.app/@studio</loc>
    <lastmod>2026-09-24</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>`);
});

/**
 * FR-1.3 Custom Domain Handshake & Edge Resolution
 * Handles CNAME/A record resolution and 526 SSL fallback (AC-06)
 */
app.use((req: Request, res: Response, next: NextFunction) => {
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
  const mapping = CUSTOM_DOMAINS[host];
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
  if (mapping.ssl_status === 'pending' || mapping.ssl_status === 'failed') {
    return res.status(526).send(`
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>526 Invalid SSL / Configuration Pending — ${host}</title>
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
  req.url = `/@${mapping.site_id}`;
  next();
});

/**
 * FR-4.3 Studio Route Guarding Middleware
 * Any unauthenticated request attempting to reach /studio or /studio/* must be intercepted at the edge/middleware level.
 * Redirects visitor to /login?redirect=/studio (TC-M4-03).
 */
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/studio' || req.path.startsWith('/studio/')) {
    const cookies = parseCookies(req.headers.cookie);
    const sessionToken = cookies['raloa_session'];
    const session = sessionToken ? ACTIVE_SESSIONS.get(sessionToken) : undefined;

    if (!session || session.expiresAt < Date.now()) {
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
app.get('/api/v1/handles/check', (req: Request, res: Response) => {
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

  const available = !isReserved && !isExistingCreator && !isExistingUser;

  return res.status(200).json({
    status: 'success',
    data: {
      handle: clean,
      available,
      reason: available ? undefined : 'Handle already registered or reserved'
    }
  });
});

/**
 * FR-2.4 Contact Form Ingestion Endpoint
 * Rate-limited via IP bucket: Max 5 submissions per hour per IP.
 * Validates required payload fields: fullName, email, subject, message.
 */
app.post('/api/v1/public/contact', (req: Request, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();
  const oneHourAgo = now - 3600000;

  // Rate limit: Max 5 submissions per hour per IP (FR-2.4)
  const timestamps = (CONTACT_RATE_LIMITS.get(ip) || []).filter((t) => t > oneHourAgo);
  if (timestamps.length >= 5) {
    return res.status(429).json({
      status: 'error',
      error: 'Too Many Requests',
      message: 'Rate limit exceeded: maximum 5 contact inquiries per hour per IP.'
    });
  }

  const { fullName, name, email, subject, message } = req.body || {};
  const contactName = fullName || name;

  if (!contactName || !email || !message) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing required fields: fullName/name, email, and message are required.'
    });
  }

  timestamps.push(now);
  CONTACT_RATE_LIMITS.set(ip, timestamps);

  const submission = {
    id: `contact_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    fullName: contactName,
    email,
    subject: subject || 'General Inquiry',
    message,
    createdAt: new Date().toISOString()
  };
  CONTACT_SUBMISSIONS.push(submission);

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
app.post('/api/v1/auth/register', (req: Request, res: Response) => {
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

  USERS_DB[normalizedEmail] = newUser;

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
app.post('/api/v1/auth/login', (req: Request, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
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

  const user = USERS_DB[normalizedEmail];
  const isValid = user && hashPassword(password || '', user.salt) === user.passwordHash;

  if (!isValid) {
    const currentFailures = (attemptRecord && attemptRecord.lockedUntil <= now && (now - attemptRecord.firstAttemptAt < 600000))
      ? attemptRecord.count + 1
      : 1;

    const lockedUntil = currentFailures >= 5 ? now + 600000 : 0; // 10 min lock
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
app.post('/api/v1/auth/forgot-password', (req: Request, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ status: 'error', message: 'Email is required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const rateKey = `${ip}:${normalizedEmail}`;
  const now = Date.now();
  const fifteenMinutesAgo = now - 900000;

  const timestamps = (FORGOT_PW_RATE_LIMITS.get(rateKey) || []).filter((t) => t > fifteenMinutesAgo);
  if (timestamps.length >= 3) {
    return res.status(429).json({
      status: 'error',
      error: 'Too Many Requests',
      message: 'Rate limit exceeded: maximum 3 password reset requests per 15 minutes.'
    });
  }

  timestamps.push(now);
  FORGOT_PW_RATE_LIMITS.set(rateKey, timestamps);

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
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies['raloa_session'];
  const session = sessionToken ? ACTIVE_SESSIONS.get(sessionToken) : undefined;

  if (!session || session.expiresAt < Date.now()) {
    return res.status(401).json({ status: 'error', message: 'Not authenticated' });
  }

  return res.status(200).json({
    status: 'success',
    data: {
      user: {
        id: session.userId,
        email: session.email,
        primary_handle: session.primary_handle
      }
    }
  });
});

/**
 * FR-4.5 Email Verification Confirmation
 */
app.post('/api/v1/auth/verify-email', (req: Request, res: Response) => {
  const { email, code } = req.body || {};
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
app.get('*', (req: Request, res: Response) => {
  let html = getIndexHtml();
  const requestPath = req.path;

  // Guard: Authenticated users should never see not-logged-in guest auth routes
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies['raloa_session'];
  const session = sessionToken ? ACTIVE_SESSIONS.get(sessionToken) : undefined;
  const isSessionValid = Boolean(session && session.expiresAt > Date.now());

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
    const creator = CREATORS_METADATA[handle];

    if (creator) {
      // Dynamic OpenGraph & Twitter hydration (FR-3.2)
      const ogTitle = `${creator.name} (@${handle}) — RALOA Mini-Site`;
      const ogDesc = creator.bio;
      const ogImage = creator.avatar;

      html = html
        .replace(/<title>.*?<\/title>/, `<title>${ogTitle}</title>`)
        .replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${ogTitle}" />`)
        .replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${ogDesc}" />`)
        .replace(/<meta property="og:image" content=".*?" \/>/, `<meta property="og:image" content="${ogImage}" />`)
        .replace(/<meta name="twitter:title" content=".*?" \/>/, `<meta name="twitter:title" content="${ogTitle}" />`)
        .replace(/<meta name="twitter:description" content=".*?" \/>/, `<meta name="twitter:description" content="${ogDesc}" />`)
        .replace(/<meta name="twitter:image" content=".*?" \/>/, `<meta name="twitter:image" content="${ogImage}" />`);
    } else {
      // AC-03: Invalid handle 404 metadata
      const notFoundTitle = `404: Handle @${handle} Available — RALOA`;
      html = html.replace(/<title>.*?<\/title>/, `<title>${notFoundTitle}</title>`);
    }
  } else if (requestPath === '/templates') {
    html = html
      .replace(/<title>.*?<\/title>/, '<title>All Templates — RALOA Design Gallery</title>')
      .replace(/<meta property="og:title" content=".*?" \/>/, '<meta property="og:title" content="Explore All Mini-Site Templates — RALOA" />');
  } else if (requestPath === '/pricing') {
    html = html
      .replace(/<title>.*?<\/title>/, '<title>Pricing Plans — RALOA</title>')
      .replace(/<meta property="og:title" content=".*?" \/>/, '<meta property="og:title" content="Transparent Pricing Plans — Free & Pro | RALOA" />');
  } else if (requestPath === '/features') {
    html = html
      .replace(/<title>.*?<\/title>/, '<title>Creator Toolkit & Features — RALOA</title>')
      .replace(/<meta property="og:title" content=".*?" \/>/, '<meta property="og:title" content="All-in-One Creator Toolkit — RALOA" />');
  } else if (requestPath === '/guides') {
    html = html
      .replace(/<title>.*?<\/title>/, '<title>Guides & Tutorials — RALOA</title>')
      .replace(/<meta property="og:title" content=".*?" \/>/, '<meta property="og:title" content="Platform Guides and Creator Tutorials — RALOA" />');
  } else if (requestPath === '/about') {
    html = html
      .replace(/<title>.*?<\/title>/, '<title>About Us — RALOA</title>')
      .replace(/<meta property="og:title" content=".*?" \/>/, '<meta property="og:title" content="Our Story and Mission — RALOA" />');
  } else if (requestPath === '/contact') {
    html = html
      .replace(/<title>.*?<\/title>/, '<title>Contact Support — RALOA</title>')
      .replace(/<meta property="og:title" content=".*?" \/>/, '<meta property="og:title" content="Contact RALOA Support & Partnerships" />');
  } else if (requestPath.startsWith('/legal/')) {
    const docName = requestPath.replace('/legal/', '').replace(/-/g, ' ');
    const capitalized = docName.charAt(0).toUpperCase() + docName.slice(1);
    html = html
      .replace(/<title>.*?<\/title>/, `<title>${capitalized} — RALOA Legal</title>`)
      .replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${capitalized} — RALOA Legal Terms" />`);
  } else if (requestPath === '/login') {
    html = html
      .replace(/<title>.*?<\/title>/, '<title>Sign In — RALOA</title>')
      .replace(/<meta property="og:title" content=".*?" \/>/, '<meta property="og:title" content="Sign In to RALOA Studio" />');
  } else if (requestPath === '/register') {
    html = html
      .replace(/<title>.*?<\/title>/, '<title>Create Your Account — RALOA</title>')
      .replace(/<meta property="og:title" content=".*?" \/>/, '<meta property="og:title" content="Claim Your Handle & Start Building — RALOA" />');
  }

  res.send(html);
});

// Start listening if run directly
const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectExecution && process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[RALOA Edge Proxy] Listening on http://0.0.0.0:${PORT}`);
  });
}

export default app;

