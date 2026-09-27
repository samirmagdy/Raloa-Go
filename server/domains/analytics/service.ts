import type { AnalyticsRollupsRepository } from '../../repositories/contracts';
export interface AnalyticsService { record(id: string, event: Record<string, unknown>): Promise<void>; list(siteOwnerId: string, limit?: number): Promise<Record<string, unknown>[]>; }
export function createAnalyticsService(repository: AnalyticsRollupsRepository): AnalyticsService {
  return { record: (id, event) => repository.saveRollup(id, event as any), list: async (siteOwnerId, limit) => (await repository.listRollups(siteOwnerId)).slice(0, limit || 100) };
}
