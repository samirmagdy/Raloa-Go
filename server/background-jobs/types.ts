export const JOB_KINDS = [
  'calendar_sync', 'email_delivery', 'domain_verification', 'oauth_refresh',
  'analytics_rollup', 'media_processing', 'stripe_reconciliation', 'cleanup'
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
}

export interface JobDispatcher {
  dispatch(job: BackgroundJob, delayMs?: number): Promise<void>;
}

export type BackgroundJobHandler = (job: BackgroundJob) => Promise<void>;
