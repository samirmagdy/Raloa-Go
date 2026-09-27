import type { Firestore } from 'firebase-admin/firestore';
import type { DomainModule } from '../../core/types';
import { createIntegrationsService, type IntegrationsService } from './service';
import { createFirestoreIntegrationsRepository } from '../../repositories/firestore';
import type { IntegrationsRepository } from '../../repositories/contracts';
import { createFirestoreOAuthRepository } from '../../infrastructure/firestore-oauth-repository';
import { createOAuthTokenService, type OAuthProviderAdapter } from './oauth-service';
export interface ExternalProvider { readonly name: string; isConfigured(): boolean; }
export interface IntegrationsModule extends DomainModule { repository: IntegrationsRepository; providers: readonly ExternalProvider[]; service: IntegrationsService; oauth: ReturnType<typeof createOAuthTokenService>; }
export function createIntegrationsModule(db: Firestore, providers: readonly ExternalProvider[], oauthAdapters: readonly OAuthProviderAdapter[] = []): IntegrationsModule {
  const repository = createFirestoreIntegrationsRepository(db);
  const oauthRepository = createFirestoreOAuthRepository(db);
  return { name: 'integrations', routes: ['/api/integrations', '/api/calendar'], repository, providers, service: createIntegrationsService(repository, providers), oauth: createOAuthTokenService(oauthRepository, oauthAdapters) };
}
