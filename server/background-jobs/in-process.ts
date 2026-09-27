import type { BackgroundJob, BackgroundJobHandler, BackgroundJobQueue, BackgroundJobRepository, JobDispatcher, JobKind } from './types';
import { createBackgroundJobService } from './service';

function createMemoryRepository(): BackgroundJobRepository {
  const jobs = new Map<string, BackgroundJob>();
  return {
    async create(job) { const existing = jobs.get(job.id); if (existing) return existing; jobs.set(job.id, job); return job; },
    async get(id) { return jobs.get(id) || null; },
    async claim(id, leaseUntil) {
      const current = jobs.get(id);
      if (!current || Date.parse(current.availableAt) > Date.now() || ['completed', 'dead_letter'].includes(current.status)) return null;
      if (current.leaseUntil && Date.parse(current.leaseUntil) > Date.now()) return null;
      const claimed = { ...current, status: 'processing' as const, attempts: current.attempts + 1, leaseUntil, updatedAt: new Date().toISOString() };
      jobs.set(id, claimed);
      return claimed;
    },
    async complete(id, completedAt) { const current = jobs.get(id); if (current?.status === 'processing') jobs.set(id, { ...current, status: 'completed', completedAt, leaseUntil: undefined, updatedAt: completedAt }); },
    async fail(id, failure) { const current = jobs.get(id); if (current?.status === 'processing') jobs.set(id, { ...current, status: failure.deadLetter ? 'dead_letter' : 'retry', lastError: failure.error, availableAt: failure.availableAt || current.availableAt, leaseUntil: undefined, deadLetteredAt: failure.deadLetter ? failure.at : undefined, updatedAt: failure.at }); },
    async listRecoverable(now, limit) { return [...jobs.values()].filter((job) => ['pending', 'retry', 'processing'].includes(job.status) && Date.parse(job.availableAt) <= Date.parse(now)).slice(0, limit); },
    async requeue(id, availableAt, reason) { const current = jobs.get(id); if (!current || ['completed', 'dead_letter'].includes(current.status)) return false; jobs.set(id, { ...current, status: 'retry', availableAt, leaseUntil: undefined, lastError: reason, updatedAt: new Date().toISOString() }); return true; },
    async deadLetter(id, reason, at) { const current = jobs.get(id); if (!current || ['completed', 'dead_letter'].includes(current.status)) return false; jobs.set(id, { ...current, status: 'dead_letter', lastError: reason, deadLetteredAt: at, leaseUntil: undefined, updatedAt: at }); return true; }
  };
}

/** Local/test-only queue. It deliberately refuses production to prevent losing durable work. */
export function createInProcessJobQueue(handlers: Partial<Record<JobKind, BackgroundJobHandler>>): BackgroundJobQueue {
  if (process.env.NODE_ENV === 'production') throw new Error('IN_PROCESS_JOBS_DISABLED_IN_PRODUCTION');
  let queue: BackgroundJobQueue;
  const dispatcher: JobDispatcher = {
    async dispatch(job, delayMs = 0) {
      setTimeout(() => { void queue.run(job.id); }, Math.max(0, delayMs));
    }
  };
  queue = createBackgroundJobService(createMemoryRepository(), dispatcher, handlers);
  return queue;
}
