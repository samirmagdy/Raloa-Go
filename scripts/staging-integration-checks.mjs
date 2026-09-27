import crypto from 'node:crypto';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const required = [
  'STAGING_BASE_URL', 'STAGING_BEARER_TOKEN', 'STAGING_SITE_ID', 'STAGING_PUBLIC_HANDLE',
  'STAGING_BOOKING_DATE', 'STAGING_BOOKING_SERVICE_ID', 'STAGING_TEST_EMAIL',
  'STAGING_STRIPE_WEBHOOK_BODY', 'STAGING_STRIPE_WEBHOOK_SIGNATURE', 'STAGING_PRODUCT_ID',
  'STAGING_DOMAIN_HOSTNAME', 'STAGING_EXPECT_CALENDAR_PROVIDER', 'STAGING_DISPOSABLE_DATA_CONFIRMATION'
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Staging integration gate refused to run. Missing: ${missing.join(', ')}`);
  process.exit(2);
}
if (process.env.STAGING_DISPOSABLE_DATA_CONFIRMATION !== 'I_UNDERSTAND') {
  console.error('STAGING_DISPOSABLE_DATA_CONFIRMATION must equal I_UNDERSTAND.');
  process.exit(2);
}

const baseUrl = process.env.STAGING_BASE_URL.replace(/\/$/, '');
if (!/^https:\/\//.test(baseUrl) && process.env.ALLOW_HTTP_STAGING !== 'true') {
  console.error('STAGING_BASE_URL must use HTTPS. Set ALLOW_HTTP_STAGING=true only for an intentional local/staging target.');
  process.exit(2);
}
const headers = { Authorization: `Bearer ${process.env.STAGING_BEARER_TOKEN}`, Accept: 'application/json, text/html, application/xml' };
const results = [];

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) }, redirect: 'manual', signal: AbortSignal.timeout(20_000) });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch {}
  return { response, text, body };
}

function check(name, condition, detail = '') {
  if (!condition) throw new Error(`${name} failed${detail ? `: ${detail}` : ''}`);
  results.push(name);
  console.log(`[PASS] ${name}`);
}

async function expect(name, path, status, predicate = () => true) {
  const result = await request(path);
  if (result.response.status !== status || !predicate(result)) throw new Error(`${name}: received HTTP ${result.response.status}`);
  check(name, true);
  return result;
}

function firestore() {
  const app = getApps()[0] || initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
  return getFirestore(app, process.env.FIRESTORE_DATABASE_ID);
}

async function pollFirestore(collection, field, value, predicate, timeoutMs = 90_000) {
  const db = firestore();
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const snapshot = await db.collection(collection).where(field, '==', value).limit(10).get();
    const match = snapshot.docs.find((doc) => predicate(doc.data()));
    if (match) return match.data();
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`${collection} did not reach the expected state within ${timeoutMs}ms`);
}

try {
  const sites = await expect('authenticated Firestore site listing', '/api/sites', 200, (r) => Array.isArray(r.body?.sites));
  const current = sites.body.sites.find((site) => site.id === process.env.STAGING_SITE_ID);
  if (!current) throw new Error('STAGING_SITE_ID is not owned by the authenticated staging creator');
  const originalPublished = current.isPublished === true;

  const publish = await request(`/api/sites/${encodeURIComponent(process.env.STAGING_SITE_ID)}` , { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isPublished: true }) });
  check('persisted publishing', [200, 201].includes(publish.response.status));
  await expect('published public API resolution', `/api/public/sites/${encodeURIComponent(process.env.STAGING_PUBLIC_HANDLE)}`, 200, (r) => r.body?.site?.isPublished === true);
  await expect('published public HTML resolution', `/@${encodeURIComponent(process.env.STAGING_PUBLIC_HANDLE)}`, 200, (r) => r.text.includes('<title>'));

  const eventId = `staging-${crypto.randomUUID()}`;
  const analytics = await request('/api/v1/public/telemetry/page-view', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': eventId }, body: JSON.stringify({ eventId, visitorId: eventId, path: `/@${process.env.STAGING_PUBLIC_HANDLE}` }) });
  check('analytics ingestion', analytics.response.status === 202 && (analytics.body?.accepted === true || analytics.body?.idempotent === true));

  const availability = await expect('real booking availability', `/api/v1/public/scheduling/${encodeURIComponent(process.env.STAGING_PUBLIC_HANDLE)}/availability?from=${encodeURIComponent(process.env.STAGING_BOOKING_DATE)}&to=${encodeURIComponent(process.env.STAGING_BOOKING_DATE)}&serviceId=${encodeURIComponent(process.env.STAGING_BOOKING_SERVICE_ID)}`, 200, (r) => Array.isArray(r.body?.slots));
  const slot = availability.body.slots?.[0];
  if (!slot?.start) throw new Error('No disposable staging booking slot is available');
  const booking = await request('/api/v1/public/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `staging-booking-${crypto.randomUUID()}` }, body: JSON.stringify({ hostHandle: process.env.STAGING_PUBLIC_HANDLE, serviceId: process.env.STAGING_BOOKING_SERVICE_ID, slotStart: slot.start, customerName: 'Staging Integration Check', customerEmail: process.env.STAGING_TEST_EMAIL }) });
  check('real booking persistence', booking.response.status === 201 && Boolean(booking.body?.id));
  const bookingId = booking.body.id;
  await expect('booking confirmation state', `/api/creator/bookings/${encodeURIComponent(bookingId)}/confirm?siteId=${encodeURIComponent(process.env.STAGING_SITE_ID)}`, 200, (r) => r.body?.confirmationStatus === 'confirmed');
  await pollFirestore('notification_jobs', 'bookingId', bookingId, (data) => data.status === 'sent');
  check('real email delivery worker', true);
  if (!['google', 'outlook'].includes(process.env.STAGING_EXPECT_CALENDAR_PROVIDER)) throw new Error('STAGING_EXPECT_CALENDAR_PROVIDER must be google or outlook');
  const calendarJob = await pollFirestore('calendar_jobs', 'bookingId', bookingId, (data) => data.provider === process.env.STAGING_EXPECT_CALENDAR_PROVIDER && data.status === 'completed');
  check('calendar worker created a real external event', Boolean(calendarJob.externalEventId));
  await expect('booking cancellation state', `/api/creator/bookings/${encodeURIComponent(bookingId)}/cancel?siteId=${encodeURIComponent(process.env.STAGING_SITE_ID)}`, 200, (r) => r.body?.confirmationStatus === 'cancelled');

  // The request must use the signed disposable fixture supplied by staging.
  const webhook = await request('/api/webhooks/stripe', { method: 'POST', headers: { 'Content-Type': 'application/json', 'stripe-signature': process.env.STAGING_STRIPE_WEBHOOK_SIGNATURE }, body: process.env.STAGING_STRIPE_WEBHOOK_BODY });
  check('Stripe webhook signature validation', webhook.response.status === 200 && webhook.body?.received === true);
  const checkout = await request(`/api/v1/public/products/${encodeURIComponent(process.env.STAGING_PUBLIC_HANDLE)}/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `staging-product-${crypto.randomUUID()}` }, body: JSON.stringify({ productId: process.env.STAGING_PRODUCT_ID, quantity: 1, customerEmail: process.env.STAGING_TEST_EMAIL }) });
  check('real Stripe checkout session creation', checkout.response.status === 201 && typeof checkout.body?.url === 'string');

  const uploadBody = new FormData();
  uploadBody.append('siteId', process.env.STAGING_SITE_ID);
  uploadBody.append('purpose', 'gallery');
  uploadBody.append('file', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), 'staging.png');
  const upload = await request('/api/media/upload', { method: 'POST', headers, body: uploadBody });
  check('real storage upload and optimization', upload.response.status === 201 && Boolean(upload.body?.media?.id));
  const mediaId = upload.body.media.id;
  const mediaDelete = await request(`/api/media/${encodeURIComponent(mediaId)}?siteId=${encodeURIComponent(process.env.STAGING_SITE_ID)}`, { method: 'DELETE' });
  check('real storage deletion', mediaDelete.response.status === 204);

  const google = await expect('Google Calendar OAuth configuration', '/api/calendar/google/start?format=json', 200, (r) => /^https:\/\//.test(r.body?.url || ''));
  const outlook = await expect('Outlook Calendar OAuth configuration', '/api/calendar/outlook/start?format=json', 200, (r) => /^https:\/\//.test(r.body?.url || ''));
  check('real calendar provider authorization URLs', Boolean(google.body.url && outlook.body.url));

  const domain = await request('/api/domains/provision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hostname: process.env.STAGING_DOMAIN_HOSTNAME, siteId: process.env.STAGING_SITE_ID }) });
  check('real Cloudflare domain provisioning', [200, 201].includes(domain.response.status) && Boolean(domain.body?.domain?.domainId));
  const domainId = domain.body.domain.domainId;
  const verify = await request('/api/domains/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domainId }) });
  check('real Cloudflare domain verification state', [200, 502].includes(verify.response.status) && Boolean(verify.body?.domain || verify.body?.error));
  const remove = await request(`/api/domains/${encodeURIComponent(domainId)}`, { method: 'DELETE' });
  check('real Cloudflare domain cleanup', remove.response.status === 204);

  const restore = await request(`/api/sites/${encodeURIComponent(process.env.STAGING_SITE_ID)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isPublished: originalPublished }) });
  check('publishing state restoration', [200, 201].includes(restore.response.status));
  console.log(`\nStaging integration gate passed: ${results.length} checks.`);
} catch (error) {
  console.error(`\nStaging integration gate failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
