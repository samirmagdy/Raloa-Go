export type OutboxStatus = 'pending' | 'publishing' | 'published' | 'retry' | 'dead_letter';

export interface OutboxEvent {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  maxAttempts: number;
  availableAt: string;
  leaseUntil?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface OutboxRepository {
  listDue(now: string, limit: number): Promise<OutboxEvent[]>;
  claim(id: string, leaseUntil: string): Promise<OutboxEvent | null>;
  markPublished(id: string, publishedAt: string): Promise<void>;
  markFailed(id: string, error: string, availableAt: string | undefined, deadLetter: boolean): Promise<void>;
}

export interface OutboxPublisher {
  publish(event: OutboxEvent): Promise<void>;
}
