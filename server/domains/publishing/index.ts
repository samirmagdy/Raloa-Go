import type { DomainModule } from '../../core/types';
import { createPublishingService, type PublishingService } from './service';
export interface PublishingModule extends DomainModule { resolvePublicSite(handle: string): Promise<Record<string, unknown> | null>; service: PublishingService; }
export function createPublishingModule(resolvePublicSite: PublishingModule['resolvePublicSite']): PublishingModule {
  return { name: 'publishing', routes: ['/api/public/sites/:handle'], resolvePublicSite, service: createPublishingService(resolvePublicSite) };
}
