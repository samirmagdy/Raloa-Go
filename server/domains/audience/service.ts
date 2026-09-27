import type { Repository } from '../../core/types';
export interface AudienceService { list(userId: string, limit?: number): Promise<Record<string, unknown>[]>; save(id: string, value: Record<string, unknown>): Promise<void>; }
export function createAudienceService(repository: Repository): AudienceService {
  return { list: async (userId, limit) => (await repository.query().where('userId', '==', userId).limit(limit || 100).get()).docs.map((doc) => doc.data()), save: (id, value) => repository.save(id, value) };
}
