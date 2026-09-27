import crypto from 'node:crypto';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const required = [
  'STAGING_BASE_URL', 'STAGING_BEARER_TOKEN', 'STAGING_SITE_ID', 'STAGING_PUBLIC_HANDLE',
  'STAGING_TEST_EMAIL', 'STAGING_CALENDAR_CASES',
  'STAGING_STRIPE_WEBHOOK_BODY', 'STAGING_STRIPE_WEBHOOK_SIGNATURE', 'STAGING_PRODUCT_ID',
  'STAGING_DOMAIN_HOSTNAME', 'STAGING_DISPOSABLE_DATA_CONFIRMATION'
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
let calendarCases;
try {
  calendarCases = JSON.parse(process.env.STAGING_CALENDAR_CASES);
} catch {
  console.error('STAGING_CALENDAR_CASES must be valid JSON.');
  process.exit(2);
}
if (!Array.isArray(calendarCases) || calendarCases.length < 2 || new Set(calendarCases.map((item) => item?.provider)).size < 2 || !['google', 'outlook'].every((provider) => calendarCases.some((item) => item?.provider === provider))) {
  console.error('STAGING_CALENDAR_CASES must contain at least one real google case and one real outlook case.');
  process.exit(2);
}
for (const calendarCase of calendarCases) {
  if (!['google', 'outlook'].includes(calendarCase?.provider) || !calendarCase.siteId || !calendarCase.publicHandle || !calendarCase.serviceId || !calendarCase.date) {
    console.error('Each STAGING_CALENDAR_CASES item requires provider, siteId, publicHandle, serviceId, and date.');
    process.exit(2);
  }
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

async function readFirestoreDocument(collection, id, predicate, timeoutMs = 30_000) {
  const db = firestore();
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const document = await db.collection(collection).doc(id).get();
    if (document.exists && predicate(document.data() || {})) return document.data();
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`${collection}/${id} did not reach the expected state within ${timeoutMs}ms`);
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

  for (const calendarCase of calendarCases) {
    const availability = await expect(`${calendarCase.provider} booking availability`, `/api/v1/public/scheduling/${encodeURIComponent(calendarCase.publicHandle)}/availability?from=${encodeURIComponent(calendarCase.date)}&to=${encodeURIComponent(calendarCase.date)}&serviceId=${encodeURIComponent(calendarCase.serviceId)}`, 200, (r) => Array.isArray(r.body?.slots));
    const slot = availability.body.slots?.[Number(calendarCase.slotIndex || 0)];
    if (!slot?.start) throw new Error(`No disposable ${calendarCase.provider} staging booking slot is available`);
    const booking = await request('/api/v1/public/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `staging-booking-${calendarCase.provider}-${crypto.randomUUID()}` }, body: JSON.stringify({ hostHandle: calendarCase.publicHandle, serviceId: calendarCase.serviceId, slotStart: slot.start, customerName: `Staging ${calendarCase.provider} Integration Check`, customerEmail: calendarCase.email || process.env.STAGING_TEST_EMAIL }) });
    check(`${calendarCase.provider} booking persistence`, booking.response.status === 201 && Boolean(booking.body?.id));
    const bookingId = booking.body.id;
    await expect(`${calendarCase.provider} booking confirmation state`, `/api/creator/bookings/${encodeURIComponent(bookingId)}/confirm?siteId=${encodeURIComponent(calendarCase.siteId)}`, 200, (r) => r.body?.confirmationStatus === 'confirmed');
    await pollFirestore('notification_jobs', 'bookingId', bookingId, (data) => data.status === 'sent');
    check(`${calendarCase.provider} real email delivery worker`, true);
    const calendarJob = await pollFirestore('calendar_jobs', 'bookingId', bookingId, (data) => data.provider === calendarCase.provider && data.status === 'completed');
    check(`${calendarCase.provider} calendar worker created a real external event`, Boolean(calendarJob.externalEventId));
    await expect(`${calendarCase.provider} booking cancellation state`, `/api/creator/bookings/${encodeURIComponent(bookingId)}/cancel?siteId=${encodeURIComponent(calendarCase.siteId)}`, 200, (r) => r.body?.confirmationStatus === 'cancelled');
  }

  // The request must use the signed disposable fixture supplied by staging.
  const webhook = await request('/api/webhooks/stripe', { method: 'POST', headers: { 'Content-Type': 'application/json', 'stripe-signature': process.env.STAGING_STRIPE_WEBHOOK_SIGNATURE }, body: process.env.STAGING_STRIPE_WEBHOOK_BODY });
  check('Stripe webhook signature validation', webhook.response.status === 200 && webhook.body?.received === true);
  const checkout = await request(`/api/v1/public/products/${encodeURIComponent(process.env.STAGING_PUBLIC_HANDLE)}/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `staging-product-${crypto.randomUUID()}` }, body: JSON.stringify({ productId: process.env.STAGING_PRODUCT_ID, quantity: 1, customerEmail: process.env.STAGING_TEST_EMAIL }) });
  check('real Stripe checkout session creation', checkout.response.status === 201 && typeof checkout.body?.url === 'string');
  const persistedOrder = await readFirestoreDocument('orders', checkout.body.id, (data) => data.productId === process.env.STAGING_PRODUCT_ID && data.status === 'pending_payment' && Number(data.inventoryReservation) === 1);
  check('checkout order persistence and inventory reservation', Boolean(persistedOrder));

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
  check('real Cloudflare domain verification state', verify.response.status === 200 && verify.body?.domain?.verificationStatus === 'verified' && verify.body?.domain?.sslStatus === 'active');
  const remove = await request(`/api/domains/${encodeURIComponent(domainId)}`, { method: 'DELETE' });
  check('real Cloudflare domain cleanup', remove.response.status === 204);

  const restore = await request(`/api/sites/${encodeURIComponent(process.env.STAGING_SITE_ID)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isPublished: originalPublished }) });
  check('publishing state restoration', [200, 201].includes(restore.response.status));
  console.log(`\nStaging integration gate passed: ${results.length} checks.`);
} catch (error) {
  console.error(`\nStaging integration gate failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
