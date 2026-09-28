import crypto from 'node:crypto';
import type { BackgroundJob, BackgroundJobHandler, BackgroundJobQueue, BackgroundJobRepository, JobDispatcher, JobKind, JobRequest } from './types';
import { validateBackgroundJob, validateWorkerPayload } from '../../src/shared/schema';
import type { ObservabilityMetrics } from '../infrastructure/observability/types';
import { captureServerException } from '../infrastructure/observability/sentry';

const DEFAULT_MAX_ATTEMPTS = 8;
const LEASE_MS = 5 * 60 * 1000;

function jobId(kind: JobKind, idempotencyKey: string): string {
  return crypto.createHash('sha256').update(`${kind}:${idempotencyKey}`).digest('hex');
}

function retryDelay(attempts: number): number {
  return Math.min(6 * 60 * 60 * 1000, 30_000 * (2 ** Math.min(attempts - 1, 8)));
}

export function createBackgroundJobService(repository: BackgroundJobRepository, dispatcher: JobDispatcher, handlers: Partial<Record<JobKind, BackgroundJobHandler>>, observability?: { metrics?: ObservabilityMetrics }): BackgroundJobQueue {
  const log = (event: string, job: BackgroundJob, details: Record<string, unknown> = {}) => console.log(JSON.stringify({ timestamp: new Date().toISOString(), event, jobId: job.id, kind: job.kind, attempts: job.attempts, correlationId: job.correlationId || job.id, release: process.env.RELEASE_ID || 'local', environment: process.env.APP_ENV || process.env.NODE_ENV || 'development', ...details }));
  const refreshDepth = async () => {
    if (!repository.countPending || !observability?.metrics?.setGauge) return;
    try {
      observability.metrics.setGauge('cloud_task.queue_depth', await repository.countPending(new Date().toISOString()), { queue: 'background_jobs' });
    } catch {
      observability.metrics.increment('cloud_task.queue_depth_errors', { queue: 'background_jobs' });
    }
  };
  void refreshDepth();
  return {
    async schedule(input: JobRequest, runAt: string): Promise<BackgroundJob> {
      if (!Number.isFinite(Date.parse(runAt))) throw new Error('INVALID_JOB_SCHEDULE');
      const now = new Date().toISOString();
      const id = jobId(input.kind, input.idempotencyKey);
      const job = validateBackgroundJob(await repository.create({ id, kind: input.kind, payload: validateWorkerPayload(input.kind, input.payload), idempotencyKey: input.idempotencyKey, correlationId: input.correlationId || id, status: 'pending', attempts: 0, maxAttempts: input.maxAttempts || DEFAULT_MAX_ATTEMPTS, availableAt: runAt, createdAt: now, updatedAt: now }));
      await dispatcher.dispatch(job, Math.max(0, Date.parse(runAt) - Date.now()));
      observability?.metrics?.increment('jobs.enqueued', { kind: job.kind });
      void refreshDepth();
      log('background_job_enqueued', job);
      return job;
    },
    async enqueue(input: JobRequest): Promise<BackgroundJob> {
      return this.schedule(input, new Date().toISOString());
    },
    async retry(id: string, reason = 'MANUAL_RETRY', delayMs = 0): Promise<BackgroundJob | null> {
      const availableAt = new Date(Date.now() + Math.max(0, delayMs)).toISOString();
      if (!(await repository.requeue(id, availableAt, reason))) return null;
      const job = await repository.get(id);
      if (job) await dispatcher.dispatch(job, delayMs);
      observability?.metrics?.increment('jobs.retries', { kind: job?.kind || 'unknown' });
      void refreshDepth();
      return job;
    },
    status: (id: string) => repository.get(id),
    deadLetter: (id: string, reason: string) => repository.deadLetter ? repository.deadLetter(id, reason, new Date().toISOString()) : Promise.resolve(false),
    async run(id: string): Promise<void> {
      const existing = await repository.get(id);
      if (!existing || existing.status === 'completed' || existing.status === 'dead_letter') return;
      const claimed = await repository.claim(id, new Date(Date.now() + LEASE_MS).toISOString());
      if (!claimed) return;
      const handler = handlers[claimed.kind];
      if (!handler) return repository.fail(id, { error: 'JOB_HANDLER_NOT_REGISTERED', deadLetter: true, at: new Date().toISOString() });
      try {
        claimed.payload = validateWorkerPayload(claimed.kind, claimed.payload);
        await handler(claimed);
        await repository.complete(id, new Date().toISOString());
        observability?.metrics?.increment('jobs.completed', { kind: claimed.kind });
        log('background_job_completed', claimed);
      } catch (error) {
        const at = new Date().toISOString();
        const deadLetter = claimed.attempts >= claimed.maxAttempts;
        captureServerException(error, {
          jobId: claimed.id,
          jobKind: claimed.kind,
          correlationId: claimed.correlationId || claimed.id,
          provider: typeof claimed.payload?.provider === 'string' ? claimed.payload.provider : undefined
        });
        const message = error instanceof Error ? error.message : 'JOB_FAILED';
        if (claimed.kind === 'stripe_reconciliation') observability?.metrics?.increment('stripe.failures', { operation: 'reconciliation' });
        if (claimed.kind === 'domain_verification') observability?.metrics?.increment('cloudflare.failures', { operation: 'domain_verification' });
        if (claimed.kind === 'oauth_refresh' || claimed.kind === 'calendar_sync') observability?.metrics?.increment('oauth.failures', { operation: claimed.kind });
        if (claimed.kind === 'media_processing') observability?.metrics?.increment('media.failures', { operation: 'processing' });
        if (/BOOKING_(?:CONFLICT|SLOT|TAKEN)|DOUBLE_BOOK/i.test(message)) observability?.metrics?.increment('booking.conflicts', { source: 'worker' });
        if (/PUBLISH/i.test(message)) observability?.metrics?.increment('publishing.failures', { source: 'worker' });
        await repository.fail(id, { error: error instanceof Error ? error.message : 'JOB_FAILED', deadLetter, availableAt: deadLetter ? undefined : new Date(Date.now() + retryDelay(claimed.attempts)).toISOString(), at });
        if (!deadLetter) observability?.metrics?.increment('jobs.retries', { kind: claimed.kind });
        observability?.metrics?.increment(deadLetter ? 'jobs.dead_lettered' : 'jobs.failed', { kind: claimed.kind });
        log(deadLetter ? 'background_job_dead_lettered' : 'background_job_retrying', claimed, { error: error instanceof Error ? error.message : 'JOB_FAILED' });
        if (!deadLetter) {
          const delayMs = retryDelay(claimed.attempts);
          await dispatcher.dispatch({ ...claimed, status: 'retry', availableAt: new Date(Date.now() + delayMs).toISOString() }, delayMs);
        }
        void refreshDepth();
      }
    },
    async reconcile(limit = 100): Promise<{ requeued: number; inspected: number }> {
      const now = new Date().toISOString();
      const jobs = await repository.listRecoverable(now, limit);
      let requeued = 0;
      for (const job of jobs) {
        const stale = job.status === 'processing' && job.leaseUntil && Date.parse(job.leaseUntil) <= Date.now();
        if (!stale && job.status !== 'pending' && job.status !== 'retry') continue;
        if (await repository.requeue(job.id, now, stale ? 'LEASE_EXPIRED_RECONCILED' : 'REDELIVERY_RECONCILED')) requeued += 1;
      }
      void refreshDepth();
      return { requeued, inspected: jobs.length };
    }
  };
}
