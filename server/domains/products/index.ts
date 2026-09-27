import type { Firestore } from 'firebase-admin/firestore';
import { firestoreRepository } from '../../infrastructure/firestore-repository';
import type { DomainModule, Repository } from '../../core/types';
export interface ProductRecord { [key: string]: unknown }
export interface ProductsModule extends DomainModule { repository: Repository<ProductRecord>; }
export function createProductsModule(db: Firestore): ProductsModule {
  return { name: 'products', routes: ['/api/creator/products', '/api/v1/public/products/:handle'], repository: firestoreRepository(db, 'creator_products') };
}
