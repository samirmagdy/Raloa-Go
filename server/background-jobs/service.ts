import crypto from 'node:crypto';
import type { BackgroundJob, BackgroundJobHandler, BackgroundJobRepository, JobDispatcher, JobKind } from './types';

const DEFAULT_MAX_ATTEMPTS = 8;
const LEASE_MS = 5 * 60 * 1000;

function jobId(kind: JobKind, idempotencyKey: string): string {
  return crypto.createHash('sha256').update(`${kind}:${idempotencyKey}`).digest('hex');
}

function retryDelay(attempts: number): number {
  return Math.min(6 * 60 * 60 * 1000, 30_000 * (2 ** Math.min(attempts - 1, 8)));
}

export function createBackgroundJobService(repository: BackgroundJobRepository, dispatcher: JobDispatcher, handlers: Partial<Record<JobKind, BackgroundJobHandler>>) {
  const log = (event: string, job: BackgroundJob, details: Record<string, unknown> = {}) => console.log(JSON.stringify({ event, jobId: job.id, kind: job.kind, attempts: job.attempts, ...details }));
  return {
    async enqueue(input: { kind: JobKind; idempotencyKey: string; payload: Record<string, unknown>; maxAttempts?: number }): Promise<BackgroundJob> {
      const now = new Date().toISOString();
      const job = await repository.create({ id: jobId(input.kind, input.idempotencyKey), kind: input.kind, payload: input.payload, idempotencyKey: input.idempotencyKey, status: 'pending', attempts: 0, maxAttempts: input.maxAttempts || DEFAULT_MAX_ATTEMPTS, availableAt: now, createdAt: now, updatedAt: now });
      await dispatcher.dispatch(job);
      log('background_job_enqueued', job);
      return job;
    },
    async run(id: string): Promise<void> {
      const existing = await repository.get(id);
      if (!existing || existing.status === 'completed' || existing.status === 'dead_letter') return;
      const claimed = await repository.claim(id, new Date(Date.now() + LEASE_MS).toISOString());
      if (!claimed) return;
      const handler = handlers[claimed.kind];
      if (!handler) return repository.fail(id, { error: 'JOB_HANDLER_NOT_REGISTERED', deadLetter: true, at: new Date().toISOString() });
      try {
        await handler(claimed);
        await repository.complete(id, new Date().toISOString());
        log('background_job_completed', claimed);
      } catch (error) {
        const at = new Date().toISOString();
        const deadLetter = claimed.attempts >= claimed.maxAttempts;
        await repository.fail(id, { error: error instanceof Error ? error.message : 'JOB_FAILED', deadLetter, availableAt: deadLetter ? undefined : new Date(Date.now() + retryDelay(claimed.attempts)).toISOString(), at });
        log(deadLetter ? 'background_job_dead_lettered' : 'background_job_retrying', claimed, { error: error instanceof Error ? error.message : 'JOB_FAILED' });
        if (!deadLetter) {
          const delayMs = retryDelay(claimed.attempts);
          await dispatcher.dispatch({ ...claimed, status: 'retry', availableAt: new Date(Date.now() + delayMs).toISOString() }, delayMs);
        }
      }
    }
  };
}
