import type { Firestore } from 'firebase-admin/firestore';
import { ownedSubcollectionRepository } from '../../infrastructure/firestore-repository';
import type { DomainModule, OwnedResourceRepository } from '../../core/types';
import { ownedDocument } from '../../core/ownership';

export interface SiteRecord { userId?: string; username?: string; isPublished?: boolean; [key: string]: unknown }
export interface SitesModule extends DomainModule { repository: OwnedResourceRepository<SiteRecord>; }

export function createSitesModule(db: Firestore): SitesModule {
  return { name: 'sites', routes: ['/api/sites', '/api/public/sites/:handle'], repository: ownedSubcollectionRepository<SiteRecord>(db, 'sites') };
}

export async function getOwnedSite(module: SitesModule, userId: string, siteId: string): Promise<SiteRecord | null> {
  return (await ownedDocument(module.repository, userId, siteId))?.data() as SiteRecord | null;
}
