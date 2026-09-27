import type { InventoryRecord, InventoryRepository } from '../../repositories/contracts';

export interface InventoryService {
  get(productId: string): Promise<InventoryRecord | null>;
  reserve(productId: string, quantity: number): Promise<void>;
  release(productId: string, quantity: number): Promise<void>;
  decrement(productId: string, quantity: number): Promise<void>;
}

export function createInventoryService(repository: InventoryRepository): InventoryService {
  return {
    get: (productId) => repository.getByProduct(productId),
    reserve: (productId, quantity) => repository.reserve(productId, quantity),
    release: (productId, quantity) => repository.release(productId, quantity),
    decrement: (productId, quantity) => repository.decrement(productId, quantity)
  };
}
