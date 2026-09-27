import type { Firestore } from 'firebase-admin/firestore';
import { ownedSubcollectionRepository } from '../../infrastructure/firestore-repository';
import type { DomainModule, OwnedResourceRepository } from '../../core/types';
import { ownedDocument } from '../../core/ownership';
import { createSitesService, type SitesService } from './service';

export interface SiteRecord { userId?: string; username?: string; isPublished?: boolean; [key: string]: unknown }
export interface SitesModule extends DomainModule { repository: OwnedResourceRepository<SiteRecord>; service: SitesService; }

export function createSitesModule(db: Firestore): SitesModule {
  const repository = ownedSubcollectionRepository<SiteRecord>(db, 'sites');
  return { name: 'sites', routes: ['/api/sites', '/api/public/sites/:handle'], repository, service: createSitesService(repository) };
}

export async function getOwnedSite(module: SitesModule, userId: string, siteId: string): Promise<SiteRecord | null> {
  return (await ownedDocument(module.repository, userId, siteId))?.data() as SiteRecord | null;
}
