import assert from 'node:assert/strict';
import { createGoogleCloudTasksDispatcher } from './server/background-jobs/dispatchers';
import type { BackgroundJob } from './server/background-jobs/types';

const calls: any[] = [];
const fakeClient = {
  queuePath: (project: string, location: string, queue: string) => `projects/${project}/locations/${location}/queues/${queue}`,
  createTask: async (request: unknown) => { calls.push(request); return [{ name: 'task-1' }]; }
};
const dispatcher = createGoogleCloudTasksDispatcher({ CLOUD_TASKS_PROJECT_ID: 'project-1', CLOUD_TASKS_LOCATION: 'europe-west1', CLOUD_TASKS_QUEUE: 'raloa', CLOUD_TASKS_WORKER_URL: 'https://worker.test/tasks/background-jobs', CLOUD_TASKS_SERVICE_ACCOUNT: 'worker@project-1.iam.gserviceaccount.com' }, fakeClient as never);
assert.ok(dispatcher);
const job: BackgroundJob = { id: 'a'.repeat(64), kind: 'email_delivery', payload: {}, idempotencyKey: 'email:test', correlationId: 'request-1', status: 'pending', attempts: 0, maxAttempts: 8, availableAt: '2026-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
await dispatcher.dispatch(job);
const task = calls[0].task;
assert.equal(task.name, 'projects/project-1/locations/europe-west1/queues/raloa/tasks/' + job.id);
assert.equal(task.httpRequest.oidcToken.serviceAccountEmail, 'worker@project-1.iam.gserviceaccount.com');
assert.equal(task.httpRequest.headers['X-Correlation-ID'], 'request-1');
assert.equal(JSON.parse(Buffer.from(task.httpRequest.body, 'base64').toString()).jobId, job.id);
console.log('Google Cloud Tasks dispatcher tests passed');
