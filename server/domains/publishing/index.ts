import type { DomainModule } from '../../core/types';
export interface PublishingModule extends DomainModule { resolvePublicSite(handle: string): Promise<Record<string, unknown> | null>; }
export function createPublishingModule(resolvePublicSite: PublishingModule['resolvePublicSite']): PublishingModule {
  return { name: 'publishing', routes: ['/api/public/sites/:handle'], resolvePublicSite };
}
