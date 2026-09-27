import assert from 'node:assert/strict';
import { processMediaAsset } from './server/domains/media/processing-worker';
import type { MediaAsset } from './server/domains/media/contracts';

const asset: MediaAsset = {
  id: 'asset-1', ownerUserId: 'user-1', siteId: 'site-1', purpose: 'gallery', lifecycle: 'processing',
  original: { provider: 'cloudflare_r2', objectKey: 'sites/site-1/media/asset-1/original', contentType: 'image/webp', bytes: 10 },
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
};
let current = asset;
const uploaded: string[] = [];
const result = await processMediaAsset({
  assetId: asset.id,
  metadata: {
    async create() {}, async get() { return current; }, async listOwned() { return [current]; }, async listAll() { return [current]; }, async listAbandoned() { return []; }, async remove() {},
    async update(_, changes) { current = { ...current, ...changes }; return current; }
  },
  storage: {
    provider: 'cloudflare_r2',
    async put(input) { uploaded.push(input.objectKey); return { provider: 'cloudflare_r2', objectKey: input.objectKey, contentType: input.contentType, bytes: input.bytes.byteLength }; },
    async delete() {}, async listKeys() { return []; }, getCdnUrl: (key) => key
  },
  processor: { async process() { return { processed: { bytes: new Uint8Array([1]), contentType: 'image/webp' }, thumbnail: { bytes: new Uint8Array([2]), contentType: 'image/webp' }, width: 100, height: 100 }; } },
  loadOriginal: async () => new Uint8Array([0]),
  clock: () => '2026-01-01T00:01:00.000Z'
});
assert.equal(result, 'processed');
assert.equal(current.lifecycle, 'ready');
assert.equal(uploaded.length, 2);
console.log('Media processing tests passed');
