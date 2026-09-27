import { normalizeProductInput, normalizeSiteContent, validateSiteContent } from './src/lib/contentSchema';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const legacy = normalizeSiteContent({
  username: 'Creator',
  displayName: 'Creator',
  bio: 'A persisted creator profile',
  templateId: 'elena',
  avatar: 'https://cdn.example/avatar.webp',
  bgStyle: 'gradient',
  accentColor: '#123456',
  links: [{ id: 'hero', title: 'Portfolio', url: 'https://example.com', type: 'link' }],
  isPublished: true
});
assert(legacy.username === 'creator', 'legacy site handles must normalize');
assert(legacy.designTokens.background.style === 'gradient', 'legacy background fields must migrate into design tokens');
assert(validateSiteContent(legacy).valid, 'valid normalized site content must pass');

const unsafe = validateSiteContent(normalizeSiteContent({
  ...legacy,
  links: [{ id: 'bad', title: 'Bad', url: 'javascript:alert(1)', type: 'link' }],
  isPublished: false
}));
assert(!unsafe.valid && unsafe.issues.some((issue) => issue.code === 'unsafe_url'), 'unsafe block URLs must fail schema validation');

const unsupported = validateSiteContent(normalizeSiteContent({ ...legacy, links: [{ id: 'unknown', title: 'Unknown', url: 'https://example.com', type: 'custom-widget' }] }));
assert(!unsupported.valid && unsupported.issues.some((issue) => issue.code === 'unsupported_block'), 'unsupported block types must fail schema validation');

const product = normalizeProductInput({ name: 'Print', description: 'Limited edition', imageUrls: ['https://cdn.example/print.webp'], priceMinor: 1200, currency: 'USD', inventory: 4, active: true });
assert(product.currency === 'usd' && product.priceMinor === 1200 && product.inventory === 4, 'products must use the canonical normalized product model');

console.log('Content schema tests passed');
