import type { Firestore } from 'firebase-admin/firestore';
import type { DomainModule } from '../../core/types';
import { createSitesService, type SitesService } from './service';
import { createFirestoreSitesRepository } from '../../repositories/firestore';
import type { SiteRecord, SitesRepository } from '../../repositories/contracts';

export { type SiteRecord } from '../../repositories/contracts';
export interface SitesModule extends DomainModule { repository: SitesRepository; service: SitesService; }

export function createSitesModule(db: Firestore): SitesModule {
  const repository = createFirestoreSitesRepository(db);
  return { name: 'sites', routes: ['/api/sites', '/api/public/sites/:handle'], repository, service: createSitesService(repository) };
}
