import type { OwnedResourceRepository } from '../../core/types';
import { ownedDocument } from '../../core/ownership';
import { requiredString, type ValidationResult } from '../../core/validation';
import type { SiteRecord } from './index';

export interface SitesService {
  listSites(userId: string): Promise<SiteRecord[]>;
  getSite(userId: string, siteId: string): Promise<SiteRecord | null>;
  validateHandle(value: unknown): ValidationResult<string>;
}

export function createSitesService(repository: OwnedResourceRepository<SiteRecord>): SitesService {
  return {
    listSites: async (userId) => (await repository.listOwned(userId)).map((snapshot) => snapshot.data()),
    getSite: async (userId, siteId) => (await ownedDocument(repository, userId, siteId))?.data() as SiteRecord | null,
    validateHandle: (value) => requiredString(value, 'handle', 30)
  };
}
