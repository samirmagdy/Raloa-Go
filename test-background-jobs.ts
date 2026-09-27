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
  async listRecoverable(now: string) { return [...this.jobs.values()].filter((job) => ['pending', 'retry', 'processing'].includes(job.status) && Date.parse(job.availableAt) <= Date.parse(now)); }
  async requeue(id: string, availableAt: string, reason: string) { const job = this.jobs.get(id); if (!job || ['completed', 'dead_letter'].includes(job.status)) return false; this.jobs.set(id, { ...job, status: 'retry', availableAt, lastError: reason }); return true; }
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
await service.run(first.id);
assert.equal(attempts, 2);
const reconciled = await service.reconcile();
assert.equal(reconciled.requeued, 0);
const interrupted = await service.enqueue({ kind: 'email_delivery', idempotencyKey: 'booking-interrupted', payload: {} });
repository.jobs.set(interrupted.id, { ...repository.jobs.get(interrupted.id)!, status: 'processing', leaseUntil: new Date(Date.now() - 1).toISOString() });
const recovered = await service.reconcile();
assert.equal(recovered.requeued, 1);
console.log('Background job idempotency, retry, and completion tests passed');
