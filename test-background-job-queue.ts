import assert from 'node:assert/strict';
import { createInProcessJobQueue } from './server/background-jobs';

process.env.NODE_ENV = 'test';
const seen: string[] = [];
const queue = createInProcessJobQueue({ email_delivery: async (job) => { seen.push(job.id); } });
const first = await queue.enqueue({ kind: 'email_delivery', idempotencyKey: 'queue-test-123456', payload: {} });
const duplicate = await queue.enqueue({ kind: 'email_delivery', idempotencyKey: 'queue-test-123456', payload: {} });
assert.equal(first.id, duplicate.id);
assert.equal((await queue.status(first.id))?.status, 'pending');
await new Promise((resolve) => setTimeout(resolve, 20));
assert.equal(seen.length, 1);
assert.equal((await queue.status(first.id))?.status, 'completed');

const delayed = await queue.schedule({ kind: 'email_delivery', idempotencyKey: 'queue-test-delayed', payload: {} }, new Date(Date.now() + 30).toISOString());
assert.equal((await queue.status(delayed.id))?.status, 'pending');
assert.equal(await queue.deadLetter(delayed.id, 'TEST_DEAD_LETTER'), true);
assert.equal((await queue.status(delayed.id))?.status, 'dead_letter');

console.log('Provider-independent background job queue tests passed');
