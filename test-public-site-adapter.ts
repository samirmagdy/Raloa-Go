import assert from 'node:assert/strict';
import { createPublicCreatorAdapter } from './server/public-site';

const adapter = createPublicCreatorAdapter({
  getPublishedSiteByHandle: async (handle) => handle === 'maker' ? { isPublished: true, displayName: 'A Maker', bio: 'Builds useful things.', username: handle, links: [], socials: [] } : null
});

const page = await adapter.loadPage('@Maker');
assert.equal(page?.handle, 'maker');
assert.equal(adapter.getMetadata(page!).title, 'A Maker (@maker) - RALOA Mini-Site');
assert.equal(adapter.getMetadata(page!).canonicalPath, '/@maker');
assert.equal(adapter.cacheControl, 'public, s-maxage=60, stale-while-revalidate=300');
assert.equal(await adapter.loadPage('bad handle'), null);
assert.equal(await adapter.loadPage('unknown'), null);
console.log('Public creator adapter boundary tests passed');
