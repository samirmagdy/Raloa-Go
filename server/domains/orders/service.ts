import type { OrderState } from './state-machine';
import { assertOrderTransition, type OrderTransitionSource } from './state-machine';
import type { OrdersRepository } from '../../repositories/contracts';
export interface OrdersService { listCreatorOrders(creatorId: string, limit?: number): Promise<Record<string, unknown>[]>; updateFulfillment(id: string, status: string): Promise<void>; transition(orderId: string, from: OrderState, to: OrderState, transitionKey: string, source: OrderTransitionSource, actorUserId?: string): Promise<Record<string, unknown>>; }
export function createOrdersService(repository: OrdersRepository): OrdersService {
  return {
    listCreatorOrders: (creatorId, limit) => repository.listByCreator(creatorId, limit),
    updateFulfillment: (id, status) => repository.save(id, { fulfillmentStatus: status }),
    async transition(orderId, from, to, transitionKey, source, actorUserId) {
      assertOrderTransition(from, to);
      return repository.transition(orderId, { orderId, from, to, transitionKey, source, actorUserId });
    }
  };
}
