import type { DomainEventName, DomainEventType } from './catalog';

export interface DomainEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  type: DomainEventType;
  name: DomainEventName;
  version: 1;
  aggregateType: string;
  aggregateId: string;
  occurredAt: string;
  payload: TPayload;
}

export type EventHandler = (event: DomainEvent) => Promise<void>;
