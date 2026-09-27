import type { Firestore } from 'firebase-admin/firestore';
import type { DomainModule } from '../../core/types';
import { createIntegrationsService, type IntegrationsService } from './service';
import { createFirestoreIntegrationsRepository } from '../../repositories/firestore';
import type { IntegrationsRepository } from '../../repositories/contracts';
export interface ExternalProvider { readonly name: string; isConfigured(): boolean; }
export interface IntegrationsModule extends DomainModule { repository: IntegrationsRepository; providers: readonly ExternalProvider[]; service: IntegrationsService; }
export function createIntegrationsModule(db: Firestore, providers: readonly ExternalProvider[]): IntegrationsModule {
  const repository = createFirestoreIntegrationsRepository(db);
  return { name: 'integrations', routes: ['/api/integrations', '/api/calendar'], repository, providers, service: createIntegrationsService(repository, providers) };
}
