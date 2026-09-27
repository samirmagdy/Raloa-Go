import type { Firestore } from 'firebase-admin/firestore';
import { firestoreRepository } from '../../infrastructure/firestore-repository';
import type { DomainModule, Repository } from '../../core/types';
import type { CloudflareProvider } from '../../core/providers';
import { createDomainsService, type DomainsService } from './service';
export interface CustomDomainRecord { [key: string]: unknown }
export interface DomainsModule extends DomainModule { repository: Repository<CustomDomainRecord>; service: DomainsService; }
export function createDomainsModule(db: Firestore, provider: CloudflareProvider): DomainsModule {
  const repository = firestoreRepository<CustomDomainRecord>(db, 'custom_domains');
  return { name: 'domains', routes: ['/api/domains'], repository, service: createDomainsService(repository, provider) };
}
