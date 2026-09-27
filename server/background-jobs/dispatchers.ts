import type { BackgroundJob, JobDispatcher } from './types';

type HttpDispatcherConfig = { url: string; token?: string };

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

export function createCloudTasksDispatcher(): JobDispatcher | null {
  const url = process.env.CLOUD_TASKS_DISPATCH_URL;
  return url ? createHttpDispatcher({ url, token: process.env.CLOUD_TASKS_AUTH_TOKEN }, 'cloud_tasks') : null;
}

export function createPubSubDispatcher(): JobDispatcher | null {
  const url = process.env.PUBSUB_DISPATCH_URL;
  return url ? createHttpDispatcher({ url, token: process.env.PUBSUB_AUTH_TOKEN }, 'pubsub') : null;
}

export function createConfiguredDispatcher(): JobDispatcher {
  return createCloudTasksDispatcher() || createPubSubDispatcher() || { dispatch: async () => undefined };
}
