import type { Repository } from '../../core/types';
export interface AnalyticsService { record(id: string, event: Record<string, unknown>): Promise<void>; list(siteOwnerId: string, limit?: number): Promise<Record<string, unknown>[]>; }
export function createAnalyticsService(repository: Repository): AnalyticsService {
  return { record: (id, event) => repository.save(id, event), list: async (siteOwnerId, limit) => (await repository.query().where('siteOwnerId', '==', siteOwnerId).limit(limit || 100).get()).docs.map((doc) => doc.data()) };
}
