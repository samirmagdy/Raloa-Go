import assert from 'node:assert/strict';
import { createAnalyticsPipeline } from './server/infrastructure/analytics/pipeline';
import type { AnalyticsEventV1 } from './src/shared/schema';

const queued: AnalyticsEventV1[] = [];
const raw = new Set<string>();
const claims = new Set<string>();
let rollupBatches = 0;
const pipeline = createAnalyticsPipeline({
  queue: { async enqueue(event) { queued.push(event); } },
  deduplicator: { async claim(eventId) { if (claims.has(eventId)) return false; claims.add(eventId); return true; } },
  rawStore: { async append(event) { if (raw.has(event.eventId)) return 'duplicate'; raw.add(event.eventId); return 'inserted'; } },
  rollups: { async update(events) { assert.equal(events.length, 1); rollupBatches += 1; } }
});

const event = {
  schemaVersion: 1,
  eventId: 'event-123456',
  eventType: 'page_view',
  siteId: 'site-1',
  occurredAt: new Date().toISOString(),
  dimensions: {},
  payload: {}
};
assert.deepEqual(await pipeline.ingest(event), { accepted: true, duplicate: false, eventId: event.eventId });
assert.deepEqual(await pipeline.ingest(event), { accepted: false, duplicate: true, eventId: event.eventId });
assert.equal(queued.length, 1);
assert.deepEqual(await pipeline.process(queued[0]), { inserted: true, rolledUp: true });
assert.deepEqual(await pipeline.process(queued[0]), { inserted: false, rolledUp: false });
assert.equal(rollupBatches, 1);
await assert.rejects(() => pipeline.ingest({ ...event, eventId: 'bad', eventType: 'unknown' }));
console.log('Analytics pipeline tests passed');
