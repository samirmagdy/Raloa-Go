import type { CloudflareProvider } from '../../core/providers';
import type { DomainsRepository } from '../../repositories/contracts';
export interface DomainsService { list(userId: string): Promise<Record<string, unknown>[]>; provision(id: string, domain: Record<string, unknown>): Promise<void>; verify(path: string): Promise<any>; remove(id: string): Promise<void>; }
export function createDomainsService(repository: DomainsRepository, provider: CloudflareProvider): DomainsService {
  return { list: (userId) => repository.listOwned(userId), provision: (id, domain) => repository.save(id, domain), verify: (path) => provider.request(path), remove: (id) => repository.remove(id) };
}
