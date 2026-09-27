import type { AudienceRepository } from '../../repositories/contracts';
export interface AudienceService { list(userId: string, limit?: number): Promise<Record<string, unknown>[]>; save(id: string, value: Record<string, unknown>): Promise<void>; }
export function createAudienceService(repository: AudienceRepository): AudienceService {
  return { list: (userId, limit) => repository.list(userId, undefined, limit), save: (id, value) => repository.save('subscriber', id, value) };
}
