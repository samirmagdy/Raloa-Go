import type { DomainEventType } from '../events';

export type OutboxStatus = 'pending' | 'publishing' | 'published' | 'retry' | 'dead_letter';

export interface OutboxEvent {
  id: string;
  eventType: DomainEventType;
  eventVersion: number;
  aggregateType: string;
  aggregateId: string;
  idempotencyKey: string;
  correlationId?: string;
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
  processedAt?: string;
  deadLetteredAt?: string;
}

export interface OutboxRepository {
  listDue(now: string, limit: number): Promise<OutboxEvent[]>;
  claim(id: string, leaseUntil: string): Promise<OutboxEvent | null>;
  markPublished(id: string, publishedAt: string): Promise<void>;
  markFailed(id: string, error: string, availableAt: string | undefined, deadLetter: boolean): Promise<void>;
  replay?(id: string, availableAt?: string): Promise<boolean>;
  replayByCorrelation?(correlationId: string, availableAt?: string): Promise<number>;
  list?(filters?: { status?: OutboxStatus; correlationId?: string; limit?: number }): Promise<OutboxEvent[]>;
  cleanupPublished?(publishedBefore: string, limit: number): Promise<number>;
}

export interface OutboxPublisher {
  publish(event: OutboxEvent): Promise<void>;
}

export type OutboxEventInput = Pick<OutboxEvent, 'aggregateType' | 'aggregateId' | 'idempotencyKey' | 'payload'> & { eventType: DomainEventType | string; eventVersion?: number; correlationId?: string; id?: string; maxAttempts?: number; availableAt?: string };

/** Transaction boundary used by bookings, orders, and future transactional domains. */
export interface TransactionalOutboxProducer {
  create(input: OutboxEventInput): OutboxEvent;
  append(transaction: unknown, event: OutboxEvent): void | Promise<void>;
  appendMany(transaction: unknown, events: readonly OutboxEvent[]): void | Promise<void>;
}
