import type { Repository } from '../../core/types';
export interface OrdersService { listCreatorOrders(creatorId: string, limit?: number): Promise<Record<string, unknown>[]>; updateFulfillment(id: string, status: string): Promise<void>; }
export function createOrdersService(repository: Repository): OrdersService {
  return { listCreatorOrders: async (creatorId, limit) => (await repository.query().where('creatorId', '==', creatorId).limit(limit || 100).get()).docs.map((doc) => doc.data()), updateFulfillment: (id, status) => repository.save(id, { fulfillmentStatus: status }) };
}
