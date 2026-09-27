import type { OrdersRepository } from '../../repositories/contracts';
export interface OrdersService { listCreatorOrders(creatorId: string, limit?: number): Promise<Record<string, unknown>[]>; updateFulfillment(id: string, status: string): Promise<void>; }
export function createOrdersService(repository: OrdersRepository): OrdersService {
  return { listCreatorOrders: (creatorId, limit) => repository.listByCreator(creatorId, limit), updateFulfillment: (id, status) => repository.save(id, { fulfillmentStatus: status }) };
}
