import assert from 'node:assert/strict';
import {
  apiRequestSchemasV1,
  backgroundJobSchemaV1,
  bookingCreateRequestSchemaV1,
  contentBlockSchemaV1,
  designTokensSchema,
  productSchemaV1,
  publicProfilePayloadSchemaV1,
  stripeProviderEventSchemaV1,
  siteConfigSchemaV1,
  validateWorkerPayload
} from './src/shared/schema';

const designTokens = {
  accentColor: '#4F46E5', surfaceColor: '#fff', cardRadius: 'rounded' as const, cardShadow: 'subtle' as const, borderStyle: 'thin' as const, themeMode: 'auto' as const,
  typography: { fontFamily: 'sans' as const, headingScale: 'standard' as const, bodyScale: 'standard' as const, headingWeight: 800 as const, bodyWeight: 400 as const },
  background: { style: 'signature' as const, coverImage: '', coverPosition: 'center' as const, overlay: 'soft' as const },
  layout: { contentWidth: 'standard' as const, cardGap: 'standard' as const, sectionSpacing: 'standard' as const, horizontalPadding: 'standard' as const }
};

assert.equal(designTokensSchema.parse(designTokens).themeMode, 'auto');
assert.equal(contentBlockSchemaV1.safeParse({ id: 'intro', title: 'Intro', url: 'https://example.com', type: 'link' }).success, true);
assert.equal(contentBlockSchemaV1.safeParse({ id: 'bad', title: 'Bad', url: 'https://example.com', type: 'unknown' }).success, false);

const site = siteConfigSchemaV1.parse({ username: 'creator', displayName: 'Creator', role: 'Artist', bio: 'Bio', bioAr: 'Bio', avatar: '', coverImage: '', designTokens, links: [], socials: [], isPublished: false, metaTitle: '', metaDescription: '', bookingConfig: { enabled: false, timezone: 'UTC', services: [], weeklyAvailability: {}, blackoutDates: [], minNoticeMinutes: 0, bookingWindowDays: 30, bufferMinutes: 0, maxBookingsPerDay: 10 } });
assert.equal(site.username, 'creator');

assert.equal(productSchemaV1.safeParse({ id: 'p1', creatorId: 'u1', name: 'Print', description: '', imageUrls: [], priceMinor: 1000, currency: 'usd', active: true, inventory: 2 }).success, true);
assert.equal(bookingCreateRequestSchemaV1.safeParse({ hostHandle: 'creator', serviceId: 'consult', slotStart: '2026-09-27T10:00:00.000Z', slotEnd: '2026-09-27T11:00:00.000Z', customerName: 'Guest', customerEmail: 'guest@example.com', idempotencyKey: 'booking-request-123456' }).success, true);
assert.equal(apiRequestSchemasV1.publicProfile.safeParse({ handle: 'creator' }).success, true);
assert.equal(publicProfilePayloadSchemaV1.safeParse({ handle: 'creator', name: 'Creator', role: '', bio: 'Bio', bioAr: 'Bio', avatar: '', coverImage: '', isPublished: true, designTokens, site: {} }).success, true);

const job = backgroundJobSchemaV1.safeParse({ id: 'job-1', kind: 'media_processing', payload: { mediaId: 'm1' }, idempotencyKey: 'media-m1', status: 'pending', attempts: 0, maxAttempts: 8, availableAt: '2026-09-27T10:00:00.000Z', createdAt: '2026-09-27T10:00:00.000Z', updatedAt: '2026-09-27T10:00:00.000Z' });
assert.equal(job.success, true);
assert.equal(validateWorkerPayload('media_processing', { mediaId: 'm1' }).mediaId, 'm1');
assert.equal(stripeProviderEventSchemaV1.safeParse({ provider: 'stripe', eventId: 'evt_1', eventType: 'checkout.session.completed', data: {}, signatureVerified: true }).success, true);
assert.equal(stripeProviderEventSchemaV1.safeParse({ provider: 'cloudflare', eventId: 'evt_1', eventType: 'dns.record.created', data: {} }).success, false);

console.log('Shared runtime schema tests passed');
