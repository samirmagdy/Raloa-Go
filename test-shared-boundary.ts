import assert from 'node:assert/strict';
import { createPublicApiClient } from './src/shared/api';
import { normalizeSiteContent } from './src/shared/schemas';
import { DEFAULT_DESIGN_TOKENS } from './src/shared/design';
import { migrateSiteConfig, publicPageSchemaV1 } from './src/shared/schema';

const requests: string[] = [];
const client = createPublicApiClient(async (input) => {
  requests.push(String(input));
  return new Response(JSON.stringify({ site: { displayName: 'Shared' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
await client.publicSite('shared');
assert.equal(requests[0], '/api/public/sites/shared');
assert.equal(normalizeSiteContent({}).designTokens.accentColor, DEFAULT_DESIGN_TOKENS.accentColor);
const migrated = migrateSiteConfig({ username: 'legacy', displayName: 'Legacy', bio: 'Profile' });
assert.equal(migrated.username, 'legacy');
assert.equal(publicPageSchemaV1.safeParse({ handle: 'legacy', name: 'Legacy', role: '', bio: 'Profile', bioAr: 'Profile', avatar: '', coverImage: '', isPublished: true, designTokens: migrated.designTokens, site: migrated }).success, true);
console.log('Shared Studio/public boundary tests passed');
