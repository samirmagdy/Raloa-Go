import type { Repository } from '../../core/types';
import type { CloudflareProvider } from '../../core/providers';
export interface DomainsService { list(userId: string): Promise<Record<string, unknown>[]>; provision(id: string, domain: Record<string, unknown>): Promise<void>; verify(path: string): Promise<any>; remove(id: string): Promise<void>; }
export function createDomainsService(repository: Repository, provider: CloudflareProvider): DomainsService {
  return { list: async (userId) => (await repository.query().where('userId', '==', userId).limit(100).get()).docs.map((doc) => doc.data()), provision: (id, domain) => repository.save(id, domain), verify: (path) => provider.request(path), remove: (id) => repository.delete(id) };
}
