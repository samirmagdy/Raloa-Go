import type { BackgroundJob, JobDispatcher } from './types';
import { CloudTasksClient } from '@google-cloud/tasks';
import { createCloudflareQueueDispatcherFromEnv } from '../adapters/cloudflare-queues';

type HttpDispatcherConfig = { url: string; token?: string };

function isAutomatedTestRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  // Vitest may execute modules before a test setup file can normalize
  // NODE_ENV. Check its worker markers as well so a configured Cloud Tasks
  // client never starts an asynchronous ADC lookup during tests.
  return env.NODE_ENV === 'test'
    || env.VITEST === 'true'
    || Boolean(env.VITEST_WORKER_ID)
    || env.E2E_TEST_MODE === 'true'
    || env.VITE_E2E_TEST_MODE === 'true';
}

function createHttpDispatcher(config: HttpDispatcherConfig, provider: string): JobDispatcher {
  return {
    async dispatch(job, delayMs = 0) {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}) },
        body: JSON.stringify({ jobId: job.id, kind: job.kind, provider, availableAt: job.availableAt, delayMs })
      });
      if (!response.ok) throw new Error(`${provider.toUpperCase()}_DISPATCH_${response.status}`);
    }
  };
}

export function createGoogleCloudTasksDispatcher(env: NodeJS.ProcessEnv = process.env, clientOverride?: Pick<CloudTasksClient, 'queuePath' | 'createTask'>): JobDispatcher | null {
  const project = env.CLOUD_TASKS_PROJECT_ID;
  const location = env.CLOUD_TASKS_LOCATION;
  const queue = env.CLOUD_TASKS_QUEUE;
  const url = env.CLOUD_TASKS_WORKER_URL;
  if (!project || !location || !queue || !url) return null;
  const client = clientOverride || new CloudTasksClient();
  const parent = client.queuePath(project, location, queue);
  return {
    async dispatch(job) {
      const taskName = `${parent}/tasks/${job.id}`;
      const scheduleSeconds = Math.max(0, Math.floor(Date.parse(job.availableAt) / 1000));
      try {
        await client.createTask({ parent, task: { name: taskName, scheduleTime: { seconds: scheduleSeconds }, httpRequest: { httpMethod: 'POST', url, headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': job.correlationId || job.id, ...(env.CLOUD_TASKS_AUTH_TOKEN ? { Authorization: `Bearer ${env.CLOUD_TASKS_AUTH_TOKEN}` } : {}) }, body: Buffer.from(JSON.stringify({ jobId: job.id, kind: job.kind, correlationId: job.correlationId || job.id, availableAt: job.availableAt })).toString('base64'), ...(env.CLOUD_TASKS_SERVICE_ACCOUNT ? { oidcToken: { serviceAccountEmail: env.CLOUD_TASKS_SERVICE_ACCOUNT, audience: env.CLOUD_TASKS_OIDC_AUDIENCE || url } } : {}) } } });
      } catch (error) {
        const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : '';
        if (code !== '6') throw error; // ALREADY_EXISTS: deterministic task name makes dispatch idempotent.
      }
    }
  };
}

/** Compatibility HTTP dispatcher for an already-managed Cloud Tasks gateway. */
export function createCloudTasksDispatcher(): JobDispatcher | null {
  const google = createGoogleCloudTasksDispatcher();
  if (google) return google;
  const url = process.env.CLOUD_TASKS_DISPATCH_URL;
  return url ? createHttpDispatcher({ url, token: process.env.CLOUD_TASKS_AUTH_TOKEN }, 'cloud_tasks') : null;
}

export function createPubSubDispatcher(): JobDispatcher | null {
  const url = process.env.PUBSUB_DISPATCH_URL;
  return url ? createHttpDispatcher({ url, token: process.env.PUBSUB_AUTH_TOKEN }, 'pubsub') : null;
}

export function createConfiguredDispatcher(): JobDispatcher {
  // Playwright's local server uses deterministic in-process fixtures. Do not
  // instantiate a cloud SDK in that mode: it would probe for ADC before any
  // browser test can start.
  if (isAutomatedTestRuntime()) {
    return { dispatch: async () => undefined };
  }
  // Cloudflare is opt-in until the Worker consumer has passed staging
  // idempotency, retry, and dead-letter validation. This prevents an
  // incomplete queue deployment from silently replacing the current path.
  const cloudflare = process.env.CLOUDFLARE_QUEUE_ENABLED === 'true'
    ? createCloudflareQueueDispatcherFromEnv()
    : null;
  const configured = cloudflare || createCloudTasksDispatcher() || createPubSubDispatcher();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') throw new Error('DURABLE_JOB_DISPATCHER_NOT_CONFIGURED');
  return { dispatch: async () => undefined };
}
