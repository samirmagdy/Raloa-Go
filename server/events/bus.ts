import type { DomainEventName } from './catalog';
import type { DomainEvent, EventHandler } from './types';

export function createDomainEventBus() {
  const handlers = new Map<DomainEventName, EventHandler[]>();
  return {
    subscribe(name: DomainEventName, handler: EventHandler): void {
      handlers.set(name, [...(handlers.get(name) || []), handler]);
    },
    async publish(event: DomainEvent): Promise<void> {
      await Promise.all((handlers.get(event.name) || []).map((handler) => handler(event)));
    }
  };
}
