import type { Firestore } from 'firebase-admin/firestore';
import type { DomainModule } from '../../core/types';
import { createFirestoreInventoryRepository } from '../../repositories/firestore';
import type { InventoryRepository } from '../../repositories/contracts';

export interface InventoryModule extends DomainModule { repository: InventoryRepository; }
export function createInventoryModule(db: Firestore): InventoryModule {
  return { name: 'inventory', routes: [], repository: createFirestoreInventoryRepository(db) };
}
