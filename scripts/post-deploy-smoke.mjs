import crypto from 'node:crypto';

const baseUrl = String(process.env.PRODUCTION_SMOKE_BASE_URL || '').replace(/\/$/, '');
const strict = process.env.SMOKE_STRICT === 'true';
const allowWrites = process.env.SMOKE_ALLOW_WRITES === 'true';
const allowExternalMutations = process.env.SMOKE_ALLOW_EXTERNAL_MUTATIONS === 'true';
const confirmation = process.env.SMOKE_DISPOSABLE_DATA_CONFIRMATION === 'I_UNDERSTAND';
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 15_000);
const results = [];
let cookie = '';

if (!baseUrl) {
  console.error('PRODUCTION_SMOKE_BASE_URL is required.');
  process.exit(2);
}

try {
  const parsed = new URL(baseUrl);
  if (parsed.protocol !== 'https:' && process.env.ALLOW_HTTP_SMOKE !== 'true') throw new Error('must use https:// (set ALLOW_HTTP_SMOKE=true only for an intentional non-production target)');
} catch (error) {
  console.error(`Invalid PRODUCTION_SMOKE_BASE_URL: ${error.message}`);
  process.exit(2);
}

function record(name, status, detail = '') {
  results.push({ name, status, detail });
  const marker = status === 'PASS' ? 'PASS' : status === 'SKIP' ? 'SKIP' : 'FAIL';
  console.log(`[${marker}] ${name}${detail ? ` — ${detail}` : ''}`);
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Accept')) headers.set('Accept', 'application/json, text/html, application/xml, text/plain');
    if (cookie && !headers.has('Cookie')) headers.set('Cookie', cookie);
    const response = await fetch(`${baseUrl}${path}`, { ...options, headers, redirect: options.redirect || 'manual', signal: controller.signal });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { /* non-JSON response */ }
    return { response, text, body };
  } finally {
    clearTimeout(timer);
  }
}

function authHeaders(extra = {}) {
  const headers = { ...extra };
  if (process.env.SMOKE_BEARER_TOKEN) headers.Authorization = `Bearer ${process.env.SMOKE_BEARER_TOKEN}`;
  return headers;
}

async function check(name, fn) {
  try {
    await fn();
  } catch (error) {
    record(name, 'FAIL', error instanceof Error ? error.message : String(error));
  }
}

function expectStatus(result, expected, label = 'unexpected status') {
  if (result.response.status !== expected) throw new Error(`${label}: expected ${expected}, received ${result.response.status}`);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for this check`);
  return value;
}

await check('Health endpoint', async () => {
  const result = await request('/api/health');
  expectStatus(result, 200);
  if (result.body?.status !== 'ok') throw new Error('health response is not ok');
  record('Health endpoint', 'PASS');
});

await check('Production readiness and required configuration', async () => {
  const result = await request('/api/readiness');
  expectStatus(result, 200, 'readiness endpoint');
  if (result.body?.status !== 'ready' || Object.values(result.body?.checks || {}).some((value) => value !== true)) throw new Error(`readiness checks are not all true: ${JSON.stringify(result.body?.checks || {})}`);
  record('Production readiness and required configuration', 'PASS');
});

await check('robots.txt and sitemap.xml', async () => {
  const robots = await request('/robots.txt');
  expectStatus(robots, 200, 'robots.txt');
  if (!robots.text.includes('Sitemap:') || !robots.text.includes('Disallow: /studio/')) throw new Error('robots.txt is missing sitemap or Studio exclusion');
  const sitemap = await request('/sitemap.xml');
  expectStatus(sitemap, 200, 'sitemap.xml');
  const sitemapUsesExpectedOrigin = sitemap.text.includes(new URL(baseUrl).origin) || sitemap.text.includes('https://raloa.app');
  if (!sitemap.text.includes('<urlset') || !sitemapUsesExpectedOrigin) throw new Error('sitemap.xml is not crawlable or does not use the configured canonical origin');
  record('robots.txt and sitemap.xml', 'PASS');
});

const publicHandle = process.env.SMOKE_PUBLIC_HANDLE;
if (publicHandle) {
  await check('Published public page resolution', async () => {
    const page = await request(`/@${encodeURIComponent(publicHandle)}`);
    expectStatus(page, 200, 'public profile');
    if (!page.text.includes('<title>') || page.text.includes('PUBLIC_SITE_NOT_FOUND')) throw new Error('public profile HTML is not rendered');
    const api = await request(`/api/public/sites/${encodeURIComponent(publicHandle)}`);
    expectStatus(api, 200, 'public site API');
    if (api.body?.site?.isPublished !== true) throw new Error('resolved public site is not persisted as published');
    record('Published public page resolution', 'PASS');
  });
} else {
  record('Published public page resolution', 'SKIP', 'set SMOKE_PUBLIC_HANDLE to verify a real published profile');
}

await check('Stripe webhook signature rejection', async () => {
  const result = await request('/api/webhooks/stripe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  expectStatus(result, 400, 'unsigned Stripe webhook');
  record('Stripe webhook signature rejection', 'PASS');
});

if (process.env.SMOKE_STRIPE_WEBHOOK_SIGNATURE && process.env.SMOKE_STRIPE_WEBHOOK_BODY) {
  await check('Stripe webhook valid signature acceptance', async () => {
    const result = await request('/api/webhooks/stripe', { method: 'POST', headers: { 'Content-Type': 'application/json', 'stripe-signature': process.env.SMOKE_STRIPE_WEBHOOK_SIGNATURE }, body: process.env.SMOKE_STRIPE_WEBHOOK_BODY });
    expectStatus(result, 200, 'signed Stripe webhook');
    if (result.body?.received !== true) throw new Error('signed webhook was not acknowledged');
    record('Stripe webhook valid signature acceptance', 'PASS');
  });
} else {
  record('Stripe webhook valid signature acceptance', 'SKIP', 'set SMOKE_STRIPE_WEBHOOK_BODY and SMOKE_STRIPE_WEBHOOK_SIGNATURE from a disposable signed fixture');
}

await check('OAuth callback safety contracts', async () => {
  for (const path of ['/api/integrations/github/callback?error=access_denied', '/api/calendar/google/callback?error=access_denied', '/api/calendar/outlook/callback?error=access_denied']) {
    const result = await request(path);
    if (![302, 303].includes(result.response.status)) throw new Error(`${path} returned ${result.response.status}, expected a safe redirect`);
    const location = result.response.headers.get('location') || '';
    if (!location.includes('/studio')) throw new Error(`${path} did not redirect to Studio error handling`);
  }
  record('OAuth callback safety contracts', 'PASS', 'GitHub, Google Calendar, and Outlook Calendar callbacks reject provider errors safely');
});

const bearerToken = process.env.SMOKE_BEARER_TOKEN;
if (bearerToken) {
  await check('Authenticated session and Firestore-backed site listing', async () => {
    const session = await request('/api/v1/auth/session', { headers: authHeaders() });
    expectStatus(session, 200, 'authenticated session');
    const sites = await request('/api/sites', { headers: authHeaders() });
    expectStatus(sites, 200, 'site listing');
    if (!Array.isArray(sites.body?.sites)) throw new Error('site listing did not return a sites array');
    record('Authenticated session and Firestore-backed site listing', 'PASS');
  });
} else {
  record('Authenticated session and Firestore-backed site listing', 'SKIP', 'set SMOKE_BEARER_TOKEN to verify creator authentication and Firestore access');
}

if (process.env.SMOKE_REQUIRE_OAUTH === 'true' && bearerToken) {
  await check('OAuth authorization endpoints', async () => {
    for (const path of ['/api/calendar/google/start?format=json', '/api/calendar/outlook/start?format=json', '/api/integrations/github/start?format=json']) {
      const result = await request(path, { headers: authHeaders() });
      expectStatus(result, 200, `${path} authorization endpoint`);
      if (!result.body?.url || !/^https:\/\//.test(result.body.url)) throw new Error(`${path} did not return an external authorization URL`);
    }
    record('OAuth authorization endpoints', 'PASS', 'Google Calendar, Outlook Calendar, and GitHub authorization URLs generated');
  });
} else {
  record('OAuth authorization endpoints', 'SKIP', 'set SMOKE_REQUIRE_OAUTH=true and SMOKE_BEARER_TOKEN to verify configured provider authorization');
}

if (allowWrites && bearerToken) {
  const siteId = process.env.SMOKE_SITE_ID;
  if (siteId) {
    await check('Publish/unpublish persistence', async () => {
      const sites = await request('/api/sites', { headers: authHeaders() });
      expectStatus(sites, 200);
      const current = sites.body?.sites?.find((site) => site.id === siteId);
      if (!current) throw new Error(`SMOKE_SITE_ID ${siteId} was not found for the authenticated creator`);
      const publish = await request(`/api/sites/${encodeURIComponent(siteId)}`, { method: 'PUT', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ isPublished: true }) });
      if (![200, 201].includes(publish.response.status)) throw new Error(`publish returned ${publish.response.status}`);
      const restore = await request(`/api/sites/${encodeURIComponent(siteId)}`, { method: 'PUT', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ isPublished: current.isPublished === true }) });
      if (![200, 201].includes(restore.response.status)) throw new Error(`publish state restore returned ${restore.response.status}`);
      record('Publish/unpublish persistence', 'PASS');
    });
  } else {
    record('Publish/unpublish persistence', 'SKIP', 'set SMOKE_SITE_ID for an explicitly writable disposable site check');
  }
} else {
  record('Publish/unpublish persistence', 'SKIP', 'safe mode; set SMOKE_ALLOW_WRITES=true with SMOKE_BEARER_TOKEN and SMOKE_SITE_ID');
}

if (allowWrites && publicHandle) {
  await check('Analytics ingestion', async () => {
    const eventId = `smoke-${crypto.randomUUID()}`;
    const result = await request('/api/v1/public/telemetry/page-view', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': eventId }, body: JSON.stringify({ path: `/@${publicHandle}?smoke=${eventId}`, eventId, visitorId: `smoke-${eventId}` }) });
    expectStatus(result, 202, 'analytics ingestion');
    record('Analytics ingestion', 'PASS');
  });
} else {
  record('Analytics ingestion', 'SKIP', 'safe mode or missing SMOKE_PUBLIC_HANDLE');
}

if (allowWrites && bearerToken && publicHandle && confirmation) {
  const bookingDate = process.env.SMOKE_BOOKING_DATE;
  const serviceId = process.env.SMOKE_BOOKING_SERVICE_ID;
  const customerEmail = process.env.SMOKE_TEST_EMAIL;
  if (bookingDate && serviceId && customerEmail) {
    await check('Booking creation and cancellation', async () => {
      const availability = await request(`/api/v1/public/scheduling/${encodeURIComponent(publicHandle)}/availability?from=${bookingDate}&to=${bookingDate}&serviceId=${encodeURIComponent(serviceId)}`);
      expectStatus(availability, 200, 'booking availability');
      const slot = availability.body?.slots?.[0];
      if (!slot?.start) throw new Error('no disposable booking slot is available');
      const idempotencyKey = `smoke-booking-${crypto.randomUUID()}`;
      const booking = await request('/api/v1/public/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ hostHandle: publicHandle, serviceId, slotStart: slot.start, customerName: 'Production Smoke Check', customerEmail }) });
      expectStatus(booking, 201, 'booking creation');
      const siteQuery = process.env.SMOKE_SITE_ID ? `?siteId=${encodeURIComponent(process.env.SMOKE_SITE_ID)}` : '';
      const cancellation = await request(`/api/creator/bookings/${encodeURIComponent(booking.body.id)}/cancel${siteQuery}`, { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: '{}' });
      expectStatus(cancellation, 200, 'booking cleanup cancellation');
      record('Booking creation and cancellation', 'PASS');
    });
  } else {
    record('Booking creation and cancellation', 'SKIP', 'set SMOKE_BOOKING_DATE, SMOKE_BOOKING_SERVICE_ID, and SMOKE_TEST_EMAIL');
  }
} else {
  record('Booking creation and cancellation', 'SKIP', 'requires disposable-data confirmation, auth, public handle, and SMOKE_ALLOW_WRITES=true');
}

if (allowWrites && allowExternalMutations && confirmation && publicHandle && process.env.SMOKE_PRODUCT_ID && process.env.SMOKE_TEST_EMAIL) {
  await check('Product checkout session creation', async () => {
    const result = await request(`/api/v1/public/products/${encodeURIComponent(publicHandle)}/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `smoke-product-${crypto.randomUUID()}` }, body: JSON.stringify({ productId: process.env.SMOKE_PRODUCT_ID, quantity: 1, customerEmail: process.env.SMOKE_TEST_EMAIL }) });
    if (result.response.status !== 201 || !result.body?.url) throw new Error(`checkout returned ${result.response.status} without a checkout URL`);
    record('Product checkout session creation', 'PASS', `pending order ${result.body.id}; use a disposable product/customer`);
  });
} else {
  record('Product checkout session creation', 'SKIP', 'requires SMOKE_ALLOW_EXTERNAL_MUTATIONS=true, disposable-data confirmation, product ID, and test email');
}

if (allowWrites && allowExternalMutations && confirmation && process.env.SMOKE_DOMAIN_HOSTNAME && bearerToken && process.env.SMOKE_SITE_ID) {
  await check('Cloudflare domain provision, verify, and cleanup', async () => {
    const provision = await request('/api/domains/provision', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ hostname: process.env.SMOKE_DOMAIN_HOSTNAME, siteId: process.env.SMOKE_SITE_ID }) });
    if (![200, 201].includes(provision.response.status) || !provision.body?.domain?.domainId) throw new Error(`domain provisioning returned ${provision.response.status}`);
    const domainId = provision.body.domain.domainId;
    const verify = await request('/api/domains/verify', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ domainId }) });
    if (![200, 502].includes(verify.response.status)) throw new Error(`domain verification returned unexpected ${verify.response.status}`);
    const remove = await request(`/api/domains/${encodeURIComponent(domainId)}`, { method: 'DELETE', headers: authHeaders() });
    if (remove.response.status !== 204) throw new Error(`domain cleanup returned ${remove.response.status}`);
    record('Cloudflare domain provision, verify, and cleanup', 'PASS');
  });
} else {
  record('Cloudflare domain provision, verify, and cleanup', 'SKIP', 'requires explicit external-mutation opt-in, disposable confirmation, domain hostname, site ID, and auth');
}

const failures = results.filter((result) => result.status === 'FAIL');
const skipped = results.filter((result) => result.status === 'SKIP');
console.log(`\nProduction smoke summary: ${results.length - failures.length - skipped.length} passed, ${failures.length} failed, ${skipped.length} skipped.`);
if (failures.length || (strict && skipped.length)) process.exit(1);
