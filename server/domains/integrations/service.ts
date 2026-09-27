import type { ExternalProvider } from './index';
export interface IntegrationsService { providers(): readonly ExternalProvider[]; isConfigured(name: string): boolean; }
export function createIntegrationsService(providers: readonly ExternalProvider[]): IntegrationsService { return { providers: () => providers, isConfigured: (name) => providers.some((provider) => provider.name === name && provider.isConfigured()) }; }
