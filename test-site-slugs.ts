import assert from 'node:assert/strict';
import { normalizeSiteSlug, RESERVED_SITE_SLUGS, validateSiteSlug } from './src/lib/siteSlug';

assert.equal(normalizeSiteSlug('  Elena_Studio!! '), 'elena_studio');
assert.equal(normalizeSiteSlug('A'.repeat(40)).length, 30);
assert.equal(validateSiteSlug('elena-studio').valid, true);
assert.equal(validateSiteSlug('ab').code, 'format');
assert.equal(validateSiteSlug('studio').code, 'reserved');
assert.equal(RESERVED_SITE_SLUGS.has('api'), true);

console.log('site slug tests passed');
