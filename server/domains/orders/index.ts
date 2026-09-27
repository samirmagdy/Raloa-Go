import type { Firestore } from 'firebase-admin/firestore';
import type { DomainModule } from '../../core/types';
import { createOrdersService, type OrdersService } from './service';
import { createFirestoreOrdersRepository } from '../../repositories/firestore';
import type { OrdersRepository } from '../../repositories/contracts';
export interface OrderRecord { [key: string]: unknown }
export interface OrdersModule extends DomainModule { repository: OrdersRepository; service: OrdersService; }
export function createOrdersModule(db: Firestore): OrdersModule {
  const repository = createFirestoreOrdersRepository(db);
  return { name: 'orders', routes: ['/api/account/orders', '/api/creator/orders'], repository, service: createOrdersService(repository) };
}
