import { analyticsEventDocumentId } from './server';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

const first = analyticsEventDocumentId('page_views', 'owner-1', 'event-1');
const duplicate = analyticsEventDocumentId('page_views', 'owner-1', 'event-1');
const differentEvent = analyticsEventDocumentId('page_views', 'owner-1', 'event-2');
const differentCollection = analyticsEventDocumentId('link_clicks', 'owner-1', 'event-1');
const differentOwner = analyticsEventDocumentId('page_views', 'owner-2', 'event-1');

assert(first === duplicate, 'the same event ID resolves to the same Firestore document ID');
assert(first !== differentEvent, 'a different event ID cannot overwrite an existing event');
assert(first !== differentCollection, 'page views and link clicks use separate deduplication namespaces');
assert(first !== differentOwner, 'the same event ID from another creator remains isolated');
