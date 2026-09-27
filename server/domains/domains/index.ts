import type { Firestore } from 'firebase-admin/firestore';
import type { DomainModule } from '../../core/types';
import type { CloudflareProvider } from '../../core/providers';
import { createFirestoreDomainsRepository } from '../../repositories/firestore';
import type { DomainsRepository } from '../../repositories/contracts';
import { createDomainsService, type DomainsService } from './service';
export interface CustomDomainRecord { [key: string]: unknown }
export interface DomainsModule extends DomainModule { repository: DomainsRepository; service: DomainsService; }
export function createDomainsModule(db: Firestore, provider: CloudflareProvider): DomainsModule {
  const repository = createFirestoreDomainsRepository(db);
  return { name: 'domains', routes: ['/api/domains'], repository, service: createDomainsService(repository, provider) };
}
