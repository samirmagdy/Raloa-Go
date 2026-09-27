export const JOB_KINDS = [
  'calendar_sync', 'email_delivery', 'domain_verification', 'oauth_refresh',
  'analytics_rollup', 'media_processing', 'stripe_reconciliation', 'order_processing', 'cleanup'
] as const;

export type JobKind = typeof JOB_KINDS[number];
export type JobStatus = 'pending' | 'processing' | 'retry' | 'completed' | 'dead_letter';

export interface BackgroundJob {
  id: string;
  kind: JobKind;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  availableAt: string;
  leaseUntil?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  deadLetteredAt?: string;
}

export interface BackgroundJobRepository {
  create(job: BackgroundJob): Promise<BackgroundJob>;
  get(id: string): Promise<BackgroundJob | null>;
  claim(id: string, leaseUntil: string): Promise<BackgroundJob | null>;
  complete(id: string, completedAt: string): Promise<void>;
  fail(id: string, failure: { error: string; availableAt?: string; deadLetter: boolean; at: string }): Promise<void>;
  listRecoverable(now: string, limit: number): Promise<BackgroundJob[]>;
  requeue(id: string, availableAt: string, reason: string): Promise<boolean>;
  deadLetter?(id: string, reason: string, at: string): Promise<boolean>;
}

export interface JobDispatcher {
  dispatch(job: BackgroundJob, delayMs?: number): Promise<void>;
}

export type BackgroundJobHandler = (job: BackgroundJob) => Promise<void>;

export interface JobRequest {
  kind: JobKind;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  maxAttempts?: number;
}

/** Provider-neutral application port. Cloud Tasks, Pub/Sub, or another broker implement it outside domain code. */
export interface BackgroundJobQueue {
  enqueue(request: JobRequest): Promise<BackgroundJob>;
  schedule(request: JobRequest, runAt: string): Promise<BackgroundJob>;
  retry(id: string, reason?: string, delayMs?: number): Promise<BackgroundJob | null>;
  status(id: string): Promise<BackgroundJob | null>;
  deadLetter(id: string, reason: string): Promise<boolean>;
  run(id: string): Promise<void>;
  reconcile(limit?: number): Promise<{ requeued: number; inspected: number }>;
}
