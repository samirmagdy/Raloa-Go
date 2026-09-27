import type { Firestore } from 'firebase-admin/firestore';
import { firestoreRepository } from '../../infrastructure/firestore-repository';
import type { DomainModule, Repository } from '../../core/types';
export interface OrderRecord { [key: string]: unknown }
export interface OrdersModule extends DomainModule { repository: Repository<OrderRecord>; }
export function createOrdersModule(db: Firestore): OrdersModule {
  return { name: 'orders', routes: ['/api/account/orders', '/api/creator/orders'], repository: firestoreRepository(db, 'orders') };
}
