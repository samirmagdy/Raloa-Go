import type { DomainModule } from '../../core/types';
import { createIntegrationsService, type IntegrationsService } from './service';
export interface ExternalProvider { readonly name: string; isConfigured(): boolean; }
export interface IntegrationsModule extends DomainModule { providers: readonly ExternalProvider[]; service: IntegrationsService; }
export function createIntegrationsModule(providers: readonly ExternalProvider[]): IntegrationsModule {
  return { name: 'integrations', routes: ['/api/integrations', '/api/calendar'], providers, service: createIntegrationsService(providers) };
}
