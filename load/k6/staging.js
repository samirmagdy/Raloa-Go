import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const baseUrl = String(__ENV.LOAD_BASE_URL || '').replace(/\/$/, '');
const token = String(__ENV.LOAD_BEARER_TOKEN || '');
const publicHandle = String(__ENV.LOAD_PUBLIC_HANDLE || '');
const siteId = String(__ENV.LOAD_SITE_ID || '');
const productId = String(__ENV.LOAD_PRODUCT_ID || '');
const serviceId = String(__ENV.LOAD_SERVICE_ID || '');
const slotStart = String(__ENV.LOAD_SLOT_START || '');
const webhookBody = String(__ENV.LOAD_STRIPE_WEBHOOK_BODY || '');
const webhookSignature = String(__ENV.LOAD_STRIPE_WEBHOOK_SIGNATURE || '');
const jobIds = String(__ENV.LOAD_JOB_IDS || '').split(',').map((value) => value.trim()).filter(Boolean);
const workerUrl = String(__ENV.LOAD_WORKER_URL || `${baseUrl}/tasks/background-jobs`).replace(/\/$/, '');
const confirmation = String(__ENV.LOAD_DISPOSABLE_DATA_CONFIRMATION || '');

if (!/^https:\/\//.test(baseUrl)) throw new Error('LOAD_BASE_URL must be an HTTPS staging URL');
if (confirmation !== 'I_UNDERSTAND') throw new Error('LOAD_DISPOSABLE_DATA_CONFIRMATION must equal I_UNDERSTAND');
if (!token || !publicHandle || !siteId || !jobIds.length) throw new Error('LOAD_BEARER_TOKEN, LOAD_PUBLIC_HANDLE, LOAD_SITE_ID, and LOAD_JOB_IDS are required');

const publicPageLatency = new Trend('public_page_latency', true);
const studioSaveLatency = new Trend('studio_save_latency', true);
const bookingLatency = new Trend('booking_latency', true);
const inventoryLatency = new Trend('inventory_latency', true);
const webhookLatency = new Trend('stripe_webhook_latency', true);
const analyticsLatency = new Trend('analytics_ingestion_latency', true);
const mediaLatency = new Trend('media_upload_latency', true);
const jobLatency = new Trend('background_job_latency', true);
const loadErrors = new Rate('load_errors');
const bookingConflicts = new Counter('booking_conflicts');
const inventoryConflicts = new Counter('inventory_conflicts');
const webhookRequests = new Counter('stripe_webhook_requests');

const authHeaders = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
const jsonHeaders = { ...authHeaders, 'Content-Type': 'application/json' };

export const options = {
  discardResponseBodies: false,
  thresholds: {
    load_errors: ['rate<0.02'],
    http_req_failed: ['rate<0.02'],
    public_page_latency: ['p(95)<800', 'p(99)<1500'],
    studio_save_latency: ['p(95)<1000'],
    booking_latency: ['p(95)<1200'],
    inventory_latency: ['p(95)<1200'],
    stripe_webhook_latency: ['p(95)<1000'],
    analytics_ingestion_latency: ['p(95)<500'],
    media_upload_latency: ['p(95)<2500'],
    background_job_latency: ['p(95)<1000'],
  },
  scenarios: {
    public_pages: { executor: 'constant-arrival-rate', rate: Number(__ENV.LOAD_PUBLIC_RPS || 20), timeUnit: '1s', duration: __ENV.LOAD_DURATION || '60s', preAllocatedVUs: 30, maxVUs: 150, exec: 'publicPages' },
    studio_saves: { executor: 'constant-vus', vus: Number(__ENV.LOAD_STUDIO_VUS || 10), duration: __ENV.LOAD_DURATION || '60s', exec: 'studioSaves' },
    concurrent_bookings: { executor: 'constant-vus', vus: Number(__ENV.LOAD_BOOKING_VUS || 20), duration: __ENV.LOAD_DURATION || '60s', exec: 'concurrentBookings' },
    inventory_reservations: { executor: 'constant-vus', vus: Number(__ENV.LOAD_INVENTORY_VUS || 20), duration: __ENV.LOAD_DURATION || '60s', exec: 'inventoryReservations' },
    stripe_webhook_burst: { executor: 'constant-arrival-rate', rate: Number(__ENV.LOAD_WEBHOOK_RPS || 20), timeUnit: '1s', duration: __ENV.LOAD_DURATION || '60s', preAllocatedVUs: 30, maxVUs: 150, exec: 'stripeWebhookBurst' },
    analytics_burst: { executor: 'constant-arrival-rate', rate: Number(__ENV.LOAD_ANALYTICS_RPS || 100), timeUnit: '1s', duration: __ENV.LOAD_DURATION || '60s', preAllocatedVUs: 100, maxVUs: 400, exec: 'analyticsBurst' },
    media_uploads: { executor: 'constant-arrival-rate', rate: Number(__ENV.LOAD_MEDIA_RPS || 5), timeUnit: '1s', duration: __ENV.LOAD_DURATION || '60s', preAllocatedVUs: 10, maxVUs: 50, exec: 'mediaUploads' },
    background_job_spike: { executor: 'constant-arrival-rate', rate: Number(__ENV.LOAD_JOB_RPS || 50), timeUnit: '1s', duration: __ENV.LOAD_DURATION || '60s', preAllocatedVUs: 60, maxVUs: 250, exec: 'backgroundJobSpike' },
  },
};

function record(response, trend, acceptedStatuses, label) {
  trend.add(response.timings.duration);
  const ok = acceptedStatuses.includes(response.status);
  loadErrors.add(!ok);
  check(response, { [`${label}: accepted response`]: () => ok });
  return ok;
}

export function publicPages() {
  const response = http.get(`${baseUrl}/@${encodeURIComponent(publicHandle)}`, { headers: { Accept: 'text/html' }, tags: { workload: 'public-page' } });
  record(response, publicPageLatency, [200], 'public page');
}

export function studioSaves() {
  const response = http.put(`${baseUrl}/api/sites/${encodeURIComponent(siteId)}`, JSON.stringify({ displayName: `Load save ${__VU}-${__ITER}`, expectedRevision: Number(__ENV.LOAD_EXPECTED_REVISION || 1) }), { headers: jsonHeaders, tags: { workload: 'studio-save' } });
  record(response, studioSaveLatency, [200, 409, 412], 'Studio save');
}

export function concurrentBookings() {
  if (!serviceId || !slotStart) return;
  const response = http.post(`${baseUrl}/api/v1/public/bookings`, JSON.stringify({ hostHandle: publicHandle, serviceId, slotStart, customerName: `Load Booking ${__VU}-${__ITER}`, customerEmail: `load-${__VU}-${__ITER}@example.invalid`, idempotencyKey: `load-booking-${__VU}-${__ITER}` }), { headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, tags: { workload: 'booking' } });
  if ([409, 412].includes(response.status)) bookingConflicts.add(1);
  record(response, bookingLatency, [201, 400, 409, 412, 422], 'booking');
}

export function inventoryReservations() {
  if (!productId) return;
  const response = http.post(`${baseUrl}/api/v1/public/products/${encodeURIComponent(publicHandle)}/checkout`, JSON.stringify({ productId, quantity: 1, customerEmail: `load-${__VU}-${__ITER}@example.invalid` }), { headers: { ...jsonHeaders, 'Idempotency-Key': `load-checkout-${__VU}-${__ITER}` }, tags: { workload: 'inventory-reservation' } });
  if ([409, 422].includes(response.status)) inventoryConflicts.add(1);
  record(response, inventoryLatency, [201, 400, 409, 422, 429], 'inventory reservation');
}

export function stripeWebhookBurst() {
  if (!webhookBody || !webhookSignature) return;
  const response = http.post(`${baseUrl}/api/webhooks/stripe`, webhookBody, { headers: { ...authHeaders, 'Content-Type': 'application/json', 'stripe-signature': webhookSignature }, tags: { workload: 'stripe-webhook' } });
  webhookRequests.add(1);
  record(response, webhookLatency, [200, 202, 400, 409], 'Stripe webhook');
}

export function analyticsBurst() {
  const eventId = `load-${__VU}-${__ITER}-${Date.now()}`;
  const response = http.post(`${baseUrl}/api/v1/public/telemetry/page-view`, JSON.stringify({ eventId, visitorId: `visitor-${__VU}`, path: `/@${publicHandle}` }), { headers: { 'Content-Type': 'application/json', 'Idempotency-Key': eventId }, tags: { workload: 'analytics' } });
  record(response, analyticsLatency, [202, 200, 409, 429], 'analytics ingestion');
}

export function mediaUploads() {
  const png = '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDAT\x08\xd7c\xf8\xcf\xc0\xf0\x1f\x00\x05\x00\x01\xff\x89\x99=\x1d\x00\x00\x00\x00IEND\xaeB\x60\x82';
  const response = http.post(`${baseUrl}/api/media/upload`, { siteId, purpose: 'gallery', file: http.file(png, `load-${__VU}-${__ITER}.png`, 'image/png') }, { headers: authHeaders, tags: { workload: 'media-upload' } });
  record(response, mediaLatency, [201, 400, 413, 422, 429], 'media upload');
}

export function backgroundJobSpike() {
  if (!jobIds.length) return;
  const jobId = jobIds[(__VU + __ITER) % jobIds.length];
  const response = http.post(workerUrl, JSON.stringify({ jobId }), { headers: jsonHeaders, tags: { workload: 'background-job' } });
  record(response, jobLatency, [202, 404, 409, 429], 'background job');
  sleep(0.01);
}
