import { requiredString, type ValidationResult } from '../../core/validation';
import type { SiteRecord, SitesRepository } from '../../repositories/contracts';

export interface SitesService {
  listSites(userId: string): Promise<SiteRecord[]>;
  getSite(userId: string, siteId: string): Promise<SiteRecord | null>;
  validateHandle(value: unknown): ValidationResult<string>;
}

export function createSitesService(repository: SitesRepository): SitesService {
  return {
    listSites: (userId) => repository.listOwned(userId),
    getSite: (userId, siteId) => repository.getOwned(userId, siteId),
    validateHandle: (value) => requiredString(value, 'handle', 30)
  };
}
