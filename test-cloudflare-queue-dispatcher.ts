import assert from 'node:assert/strict';
import { createCloudflareQueueDispatcher } from './server/adapters/cloudflare-queues';

const calls: Array<{ url: string; init?: RequestInit }> = [];
const dispatcher = createCloudflareQueueDispatcher({ accountId: 'account', queueName: 'jobs', apiToken: 'secret' }, async (url, init) => {
  calls.push({ url: String(url), init });
  return new Response('{}', { status: 200 });
});

await dispatcher.dispatch({
  id: 'job-1', kind: 'analytics_rollup', payload: { eventId: 'event-1' }, idempotencyKey: 'analytics:event-1',
  status: 'pending', attempts: 0, maxAttempts: 5, availableAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
});

assert.equal(calls.length, 1);
assert.equal(calls[0].url, 'https://api.cloudflare.com/client/v4/accounts/account/queues/jobs/messages');
assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, 'Bearer secret');
const body = JSON.parse(String(calls[0].init?.body));
assert.equal(body.type, 'analytics_rollup');
assert.equal(body.idempotencyKey, 'analytics:event-1');
console.log('cloudflare queue dispatcher tests passed');
