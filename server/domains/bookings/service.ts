import type { Repository } from '../../core/types';
export interface BookingsService { create(id: string, booking: Record<string, unknown>): Promise<void>; list(hostUserId: string, limit?: number): Promise<Record<string, unknown>[]>; update(id: string, value: Record<string, unknown>): Promise<void>; }
export function createBookingsService(repository: Repository): BookingsService {
  return { create: (id, booking) => repository.create(id, booking), list: async (hostUserId, limit) => (await repository.query().where('hostUserId', '==', hostUserId).limit(limit || 100).get()).docs.map((doc) => doc.data()), update: (id, value) => repository.save(id, value) };
}
