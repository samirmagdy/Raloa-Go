import { getPlanCapabilities, getPlanTier, isPremiumTemplate } from './src/lib/planCapabilities';
import { validateSiteEntitlements } from './server';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

const baseSite = { templateId: 'elena', displayName: 'Creator', bio: 'A complete creator biography.', links: [], bgStyle: 'signature', cardRadius: 'rounded', cardShadow: 'subtle', borderStyle: 'thin', isPublished: false };
const free = { plan: 'free' as const };
const pro = { plan: 'pro' as const };
const studio = { plan: 'studio' as const };

assert(getPlanTier(free) === 'free', 'free plan resolves to free tier');
assert(getPlanTier(pro) === 'pro', 'pro plan resolves to pro tier');
assert(getPlanTier(studio) === 'studio', 'studio plan resolves to studio tier');
assert(getPlanTier({ plan: 'pro', referralProUntil: '2000-01-01T00:00:00.000Z' }) === 'free', 'expired referral Pro resolves to free tier');
assert(getPlanCapabilities(free).maxLinks === 10, 'free plan has the ten-link boundary');
assert(getPlanCapabilities(pro).premiumTemplates, 'pro plan enables premium templates');
assert(getPlanCapabilities(studio).studioControls, 'studio plan enables studio controls');
assert(!isPremiumTemplate('elena') && isPremiumTemplate('nova'), 'template premium classification is centralized');

assert(validateSiteEntitlements({ ...baseSite, links: Array.from({ length: 11 }, (_, index) => ({ id: `l${index}`, title: 'Link', url: 'https://example.com' })) }, free)?.feature === 'links', 'free link limit is enforced server-side');
assert(validateSiteEntitlements({ ...baseSite, templateId: 'nova' }, free)?.feature === 'premiumTemplates', 'free premium template access is rejected');
assert(validateSiteEntitlements({ ...baseSite, bgStyle: 'immersive' }, free)?.feature === 'backgroundStyle', 'free premium background is rejected');
assert(validateSiteEntitlements({ ...baseSite, avatar: 'https://example.com/avatar.png', coverImage: 'https://example.com/cover.png', links: Array.from({ length: 9 }, (_, index) => ({ id: `m${index}`, title: 'Media', url: 'https://example.com', thumbnail: `https://example.com/${index}.png` })) }, free)?.feature === 'media', 'free media asset limit is enforced server-side');
assert(validateSiteEntitlements({ ...baseSite, links: [{ id: 'video', title: 'Video', url: 'https://example.com', type: 'video' }] }, pro)?.feature === 'blockType', 'Pro cannot use Studio-only blocks');
assert(validateSiteEntitlements({ ...baseSite, webhookUrl: 'https://hooks.example.com' }, pro)?.feature === 'studioControls', 'Pro cannot use Studio-only integrations');
assert(validateSiteEntitlements({ ...baseSite, templateId: 'nova' }, pro) === null, 'Pro can use premium templates');
assert(validateSiteEntitlements({ ...baseSite, links: [{ id: 'video', title: 'Video', url: 'https://example.com', type: 'video' }] }, studio) === null, 'Studio can use Studio-only blocks');
assert(validateSiteEntitlements({ ...baseSite, links: [{ id: 'gallery', title: 'Gallery', url: '#gallery', type: 'gallery', galleryItems: [{ id: 'image-1', src: 'https://images.example/one.jpg', thumbnail: 'https://images.example/one-thumb.jpg', alt: 'One', caption: 'One', type: 'image' }] }] }, free) === null, 'persisted galleries with valid media items are accepted');
assert(validateSiteEntitlements({ ...baseSite, links: [{ id: 'gallery', title: 'Gallery', url: '#gallery', type: 'gallery', galleryItems: [{ id: 'image-1', src: 'javascript:alert(1)', type: 'image' }] }] }, free)?.feature === 'gallery', 'unsafe gallery media URLs are rejected server-side');
