import type { DomainModule } from '../../core/types';
export interface ExternalProvider { readonly name: string; isConfigured(): boolean; }
export interface IntegrationsModule extends DomainModule { providers: readonly ExternalProvider[]; }
export function createIntegrationsModule(providers: readonly ExternalProvider[]): IntegrationsModule {
  return { name: 'integrations', routes: ['/api/integrations', '/api/calendar'], providers };
}
