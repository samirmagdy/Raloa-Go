import type { Repository } from '../../core/types';
export interface ProductsService { list(creatorId: string, siteId?: string): Promise<Record<string, unknown>[]>; save(id: string, product: Record<string, unknown>): Promise<void>; remove(id: string): Promise<void>; }
export function createProductsService(repository: Repository): ProductsService {
  return { list: async (creatorId, siteId) => { const query = repository.query().where('creatorId', '==', creatorId); const scoped = siteId ? query.where('siteId', '==', siteId) : query; return (await scoped.limit(100).get()).docs.map((doc) => doc.data()); }, save: (id, product) => repository.save(id, product), remove: (id) => repository.delete(id) };
}
