import { z } from 'zod';

const analyticsEventSchema = z.object({
  schemaVersion: z.literal(1),
  eventId: z.string().min(8).max(200),
  eventType: z.enum(['page_view', 'link_click']),
  siteId: z.string().min(1).max(200),
  siteOwnerId: z.string().min(1).max(200).optional(),
  occurredAt: z.string().datetime(),
  visitorHash: z.string().min(1).max(256).optional(),
  dimensions: z.record(z.string(), z.string().max(500)).default({}),
  payload: z.record(z.string(), z.unknown()).default({}),
});

const jobSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  idempotencyKey: z.string().min(1),
  attempt: z.number().int().nonnegative(),
  payload: z.record(z.string(), z.unknown()),
  correlationId: z.string().optional(),
});

type AnalyticsBucket = { put(key: string, value: string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown> };
type WorkerEnv = {
  ANALYTICS_RAW: AnalyticsBucket;
  APPLICATION_WORKER_URL?: string;
  INTERNAL_WORKER_TOKEN?: string;
};
type QueueMessage = { body: unknown; ack(): void; retry(options?: { delaySeconds?: number }): void };
type QueueBatch = { messages: QueueMessage[] };

function rawEventKey(event: { eventId: string; occurredAt: string }): string {
  const date = new Date(event.occurredAt);
  const hour = Number.isNaN(date.getTime()) ? 'invalid' : date.toISOString().slice(0, 13).replace('T', '/');
  return `raw-events/schema=1/year=${hour.slice(0, 4)}/month=${hour.slice(5, 7)}/day=${hour.slice(8, 10)}/hour=${hour.slice(11, 13)}/${event.eventId}.json`;
}

async function persistRawAnalytics(event: unknown, env: WorkerEnv): Promise<void> {
  const parsed = analyticsEventSchema.parse(event);
  await env.ANALYTICS_RAW.put(rawEventKey(parsed), JSON.stringify(parsed), { httpMetadata: { contentType: 'application/json' } });
}

async function forwardToApplication(job: unknown, env: WorkerEnv): Promise<void> {
  if (!env.APPLICATION_WORKER_URL) throw new Error('APPLICATION_WORKER_URL_NOT_CONFIGURED');
  const response = await fetch(env.APPLICATION_WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(env.INTERNAL_WORKER_TOKEN ? { Authorization: `Bearer ${env.INTERNAL_WORKER_TOKEN}` } : {}) },
    body: JSON.stringify(job),
  });
  if (!response.ok) throw new Error(`APPLICATION_WORKER_${response.status}`);
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/ingest/analytics') return new Response('Not found', { status: 404 });
    const token = env.INTERNAL_WORKER_TOKEN;
    if (token && request.headers.get('Authorization') !== `Bearer ${token}`) return new Response('Unauthorized', { status: 401 });
    try {
      await persistRawAnalytics(await request.json(), env);
      return Response.json({ accepted: true });
    } catch {
      return Response.json({ accepted: false, error: 'INVALID_ANALYTICS_EVENT' }, { status: 400 });
    }
  },

  async queue(batch: QueueBatch, env: WorkerEnv): Promise<void> {
    for (const message of batch.messages) {
      try {
        const job = jobSchema.parse(message.body);
        if (job.type === 'analytics_rollup') {
          await persistRawAnalytics(job.payload, env);
        }
        // PostgreSQL remains the rollup authority. The Worker stores the raw
        // event first, then asks the application worker to perform the
        // idempotent transactional rollup.
        await forwardToApplication(job, env);
        message.ack();
      } catch {
        message.retry({ delaySeconds: 60 });
      }
    }
  },
};
