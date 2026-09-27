import assert from 'node:assert/strict';
import { MemoryCacheStore } from './server/infrastructure/cache/memory';
import { cacheKey, CACHE_POLICIES } from './server/infrastructure/cache/policy';
import { createPublicCreatorAdapter } from './server/public-site/adapter';

const cache = new MemoryCacheStore();
let reads = 0;
const adapter = createPublicCreatorAdapter({
  cache,
  async getPublishedSiteByHandle() {
    reads += 1;
    return { isPublished: true, displayName: 'Cached Creator', role: '', bio: '', bioAr: '', avatar: '', coverImage: '', metaTitle: '', metaDescription: '', designTokens: { accentColor: '#000', surfaceColor: '#fff', cardRadius: 'rounded', cardShadow: 'none', borderStyle: 'none', themeMode: 'light', typography: { fontFamily: 'sans', headingScale: 'standard', bodyScale: 'standard', headingWeight: 700, bodyWeight: 400 }, background: { style: 'minimal', coverImage: '', coverPosition: 'center', overlay: 'none' }, layout: { contentWidth: 'standard', cardGap: 'standard', sectionSpacing: 'standard', horizontalPadding: 'standard' } } };
  }
});
await adapter.loadPage('Creator');
await adapter.loadPage('creator');
assert.equal(reads, 1);
await adapter.invalidate('creator');
await adapter.loadPage('creator');
assert.equal(reads, 2);
assert.equal(cacheKey('publishedSite', 'Creator'), 'public-site:v1:creator');
assert.equal(CACHE_POLICIES.publishedSite.ttlSeconds, 60);
console.log('Cache policy tests passed');
