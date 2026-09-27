import { domainEventPayloadSchemasV1, type DomainEventNameV1, validateDomainEventPayloadV1 } from '../../src/shared/schema';
import { eventType, type DomainEventName } from './catalog';

export type DomainEventPayloadV1 = {
  [Name in DomainEventNameV1]: ReturnType<typeof domainEventPayloadSchemasV1[Name]['parse']>
}[DomainEventNameV1];

export function createVersionedDomainEvent<T extends DomainEventNameV1>(input: { id: string; name: T; aggregateType: string; aggregateId: string; occurredAt?: string; payload: unknown }) {
  const occurredAt = input.occurredAt || new Date().toISOString();
  return {
    id: input.id,
    type: eventType(input.name as DomainEventName, 1),
    name: input.name,
    version: 1 as const,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    occurredAt,
    payload: validateDomainEventPayloadV1(input.name, input.payload)
  };
}
