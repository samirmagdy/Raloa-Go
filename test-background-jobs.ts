import assert from 'node:assert/strict';
import { createBackgroundJobService } from './server/background-jobs/service';
import type { BackgroundJob, BackgroundJobRepository, JobDispatcher } from './server/background-jobs/types';

class MemoryRepository implements BackgroundJobRepository {
  jobs = new Map<string, BackgroundJob>();
  async create(job: BackgroundJob) { const existing = this.jobs.get(job.id); if (existing) return existing; this.jobs.set(job.id, job); return job; }
  async get(id: string) { return this.jobs.get(id) || null; }
  async claim(id: string, leaseUntil: string) { const job = this.jobs.get(id); if (!job || Date.parse(job.availableAt) > Date.now() || job.status === 'completed' || job.status === 'dead_letter') return null; const next = { ...job, status: 'processing' as const, attempts: job.attempts + 1, leaseUntil }; this.jobs.set(id, next); return next; }
  async complete(id: string, completedAt: string) { const job = this.jobs.get(id)!; this.jobs.set(id, { ...job, status: 'completed', completedAt }); }
  async fail(id: string, failure: { error: string; availableAt?: string; deadLetter: boolean; at: string }) { const job = this.jobs.get(id)!; this.jobs.set(id, { ...job, status: failure.deadLetter ? 'dead_letter' : 'retry', lastError: failure.error, availableAt: failure.availableAt || job.availableAt }); }
}

const repository = new MemoryRepository();
const dispatched: string[] = [];
const dispatcher: JobDispatcher = { dispatch: async (job) => { dispatched.push(job.id); } };
let attempts = 0;
const service = createBackgroundJobService(repository, dispatcher, {
  email_delivery: async () => { attempts += 1; if (attempts < 2) throw new Error('TEMPORARY_FAILURE'); }
});

const first = await service.enqueue({ kind: 'email_delivery', idempotencyKey: 'booking-1', payload: {}, maxAttempts: 2 });
const second = await service.enqueue({ kind: 'email_delivery', idempotencyKey: 'booking-1', payload: {} });
assert.equal(first.id, second.id);
assert.equal(dispatched.length, 2);
await service.run(first.id);
assert.equal((await repository.get(first.id))?.status, 'retry');
repository.jobs.set(first.id, { ...repository.jobs.get(first.id)!, availableAt: new Date().toISOString() });
await service.run(first.id);
assert.equal((await repository.get(first.id))?.status, 'completed');
console.log('Background job idempotency, retry, and completion tests passed');
