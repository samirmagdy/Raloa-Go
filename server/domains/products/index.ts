import type { Firestore } from 'firebase-admin/firestore';
import { firestoreRepository } from '../../infrastructure/firestore-repository';
import type { DomainModule, Repository } from '../../core/types';
import { createProductsService, type ProductsService } from './service';
export interface ProductRecord { [key: string]: unknown }
export interface ProductsModule extends DomainModule { repository: Repository<ProductRecord>; service: ProductsService; }
export function createProductsModule(db: Firestore): ProductsModule {
  const repository = firestoreRepository<ProductRecord>(db, 'creator_products');
  return { name: 'products', routes: ['/api/creator/products', '/api/v1/public/products/:handle'], repository, service: createProductsService(repository) };
}
