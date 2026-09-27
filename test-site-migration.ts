import assert from 'node:assert/strict';
import { normalizeSiteProjection, reconcileSiteProjection } from './server/domains/sites/migration';

const firestore = normalizeSiteProjection({ id: 'site-1', username: 'Creator_One', isPublished: true, revision: 4, content: { username: 'Creator_One', revision: 4, designTokens: { themeMode: 'dark' } } });
const postgres = normalizeSiteProjection({ legacySiteId: 'site-1', handle: 'creator_one', isPublished: true, revision: 4, content: { username: 'Creator_One', revision: 4, designTokens: { themeMode: 'dark' } } });
assert.deepEqual(reconcileSiteProjection(firestore, postgres), { equal: true, differences: [] });
assert.equal(reconcileSiteProjection(firestore, { ...postgres, revision: 5 }).equal, false);
assert.deepEqual(reconcileSiteProjection(firestore, { ...postgres, revision: 5 }).differences, ['revision']);
console.log('Site migration reconciliation tests passed');

