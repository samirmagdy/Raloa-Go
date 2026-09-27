import type { DomainEventName } from './catalog';
import type { DomainEvent, EventHandler } from './types';
import { domainEventSchemaV1 } from '../../src/shared/schema';

export function createDomainEventBus() {
  const handlers = new Map<DomainEventName, EventHandler[]>();
  return {
    subscribe(name: DomainEventName, handler: EventHandler): void {
      handlers.set(name, [...(handlers.get(name) || []), handler]);
    },
    async publish(event: DomainEvent): Promise<void> {
      domainEventSchemaV1.parse(event);
      await Promise.all((handlers.get(event.name) || []).map((handler) => handler(event)));
    }
  };
}
