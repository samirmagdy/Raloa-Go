import type { Firestore } from 'firebase-admin/firestore';
import { firestoreRepository } from '../../infrastructure/firestore-repository';
import type { DomainModule, Repository } from '../../core/types';
import { createOrdersService, type OrdersService } from './service';
export interface OrderRecord { [key: string]: unknown }
export interface OrdersModule extends DomainModule { repository: Repository<OrderRecord>; service: OrdersService; }
export function createOrdersModule(db: Firestore): OrdersModule {
  const repository = firestoreRepository<OrderRecord>(db, 'orders');
  return { name: 'orders', routes: ['/api/account/orders', '/api/creator/orders'], repository, service: createOrdersService(repository) };
}
