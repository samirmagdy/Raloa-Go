import type { BackgroundJob, JobDispatcher } from '../background-jobs/types';

export type CloudflareQueueConfig = {
  accountId: string;
  queueName: string;
  apiToken: string;
};

/**
 * HTTP producer for Cloudflare Queues. The application only depends on the
 * JobDispatcher port; Cloudflare's API shape stays inside this adapter.
 */
export function createCloudflareQueueDispatcher(
  config: CloudflareQueueConfig,
  fetchImpl: typeof fetch = fetch,
): JobDispatcher {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/queues/${encodeURIComponent(config.queueName)}/messages`;

  return {
    async dispatch(job: BackgroundJob, delayMs = 0) {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: job.id,
          type: job.kind,
          idempotencyKey: job.idempotencyKey,
          attempt: job.attempts,
          availableAt: job.availableAt,
          delayMs,
          correlationId: job.correlationId || job.id,
          payload: job.payload,
        }),
      });

      if (!response.ok) throw new Error(`CLOUDFLARE_QUEUE_DISPATCH_${response.status}`);
    },
  };
}

export function createCloudflareQueueDispatcherFromEnv(env: NodeJS.ProcessEnv = process.env): JobDispatcher | null {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID || env.CLOUDFLARE_R2_ACCOUNT_ID;
  const queueName = env.CLOUDFLARE_QUEUE_NAME;
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !queueName || !apiToken) return null;
  return createCloudflareQueueDispatcher({ accountId, queueName, apiToken });
}
