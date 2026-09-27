import assert from 'node:assert/strict';
import { isSupportedBlockType, isSupportedEmbedUrl, SUPPORTED_BLOCK_TYPES } from './src/lib/blockTypes';

assert.deepEqual(SUPPORTED_BLOCK_TYPES, ['link', 'gallery', 'booking', 'shop', 'video', 'music', 'contact', 'newsletter', 'header']);
for (const type of SUPPORTED_BLOCK_TYPES) assert.equal(isSupportedBlockType(type), true);
assert.equal(isSupportedBlockType('unknown'), false);
assert.equal(isSupportedEmbedUrl('video', 'https://www.youtube.com/watch?v=abc123'), true);
assert.equal(isSupportedEmbedUrl('video', 'https://example.com/video'), false);
assert.equal(isSupportedEmbedUrl('music', 'https://open.spotify.com/track/abc123'), true);
assert.equal(isSupportedEmbedUrl('music', 'https://example.com/audio'), false);
console.log('Block type contract tests passed');
