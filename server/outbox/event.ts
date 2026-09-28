import crypto from 'node:crypto';
import type { DomainEventName } from '../events';
import { eventType } from '../events';
import type { OutboxEvent, OutboxEventInput } from './types';
import { domainEventSchemaV1, outboxEventSchemaV1 } from '../../src/shared/schema';

export function createOutboxEvent(input: OutboxEventInput): OutboxEvent {
  const now = new Date().toISOString();
  const [name, version] = input.eventType.split('.v');
  const eventVersion = input.eventVersion || Number(version || 1);
  const normalized = { ...input, id: input.id || crypto.createHash('sha256').update(input.idempotencyKey).digest('hex'), eventType: eventType(name as DomainEventName, eventVersion), eventVersion, maxAttempts: input.maxAttempts || 8, availableAt: input.availableAt || now, status: 'pending' as const, attempts: 0, createdAt: now, updatedAt: now };
  domainEventSchemaV1.parse({ id: normalized.id, type: normalized.eventType, name, version: eventVersion, aggregateType: normalized.aggregateType, aggregateId: normalized.aggregateId, occurredAt: normalized.createdAt, payload: normalized.payload });
  return outboxEventSchemaV1.parse(normalized) as OutboxEvent;
}
