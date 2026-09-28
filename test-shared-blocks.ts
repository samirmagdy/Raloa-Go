import assert from 'node:assert/strict';
import { BLOCK_DEFINITIONS, PRODUCTION_BLOCK_TYPES, normalizeBlock, normalizeBlocks } from '@raloa/blocks';

assert.deepEqual(Object.keys(BLOCK_DEFINITIONS), [...PRODUCTION_BLOCK_TYPES]);
for (const type of PRODUCTION_BLOCK_TYPES) {
  assert.equal(BLOCK_DEFINITIONS[type].editorKey, type);
  assert.equal(BLOCK_DEFINITIONS[type].previewRendererKey, type);
  assert.equal(BLOCK_DEFINITIONS[type].publicRendererKey, type);
}
assert.equal(normalizeBlock({ id: 'link-1', type: 'link', title: 'Portfolio', url: 'https://example.com' }).issues.length, 0);
assert.equal(normalizeBlock({ id: 'bad-1', type: 'unknown', title: 'Bad' }).block, null);
assert.equal(normalizeBlock({ id: 'bad-2', type: 'link', title: 'Unsafe', url: 'javascript:alert(1)' }).block, null);
assert.equal(normalizeBlocks([{ id: 'ok', type: 'header', title: 'Work' }, { id: 'bad', type: 'unknown' }]).blocks.length, 1);
console.log('Shared block architecture contract tests passed');
