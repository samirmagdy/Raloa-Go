import type { Firestore } from 'firebase-admin/firestore';
import { firestoreRepository } from '../../infrastructure/firestore-repository';
import type { DomainModule, Repository } from '../../core/types';
export interface CustomDomainRecord { [key: string]: unknown }
export interface DomainsModule extends DomainModule { repository: Repository<CustomDomainRecord>; }
export function createDomainsModule(db: Firestore): DomainsModule {
  return { name: 'domains', routes: ['/api/domains'], repository: firestoreRepository(db, 'custom_domains') };
}
