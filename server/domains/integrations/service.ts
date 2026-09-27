import type { ExternalProvider } from './index';
import type { IntegrationsRepository } from '../../repositories/contracts';
export interface IntegrationsService { list(userId: string): Promise<Record<string, unknown>[]>; providers(): readonly ExternalProvider[]; isConfigured(name: string): boolean; }
export function createIntegrationsService(repository: IntegrationsRepository, providers: readonly ExternalProvider[]): IntegrationsService { return { list: (userId) => repository.listForUser(userId), providers: () => providers, isConfigured: (name) => providers.some((provider) => provider.name === name && provider.isConfigured()) }; }
