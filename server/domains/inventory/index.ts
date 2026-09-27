import type { Firestore } from 'firebase-admin/firestore';
import type { DomainModule } from '../../core/types';
import { createFirestoreInventoryRepository } from '../../repositories/firestore';
import type { InventoryRepository } from '../../repositories/contracts';
import { createInventoryService, type InventoryService } from './service';

export interface InventoryModule extends DomainModule { repository: InventoryRepository; service: InventoryService; }
export function createInventoryModule(db: Firestore): InventoryModule {
  const repository = createFirestoreInventoryRepository(db);
  return { name: 'inventory', routes: [], repository, service: createInventoryService(repository) };
}
