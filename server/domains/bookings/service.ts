import type { BookingsRepository } from '../../repositories/contracts';
export interface BookingsService { create(id: string, booking: Record<string, unknown>): Promise<void>; list(hostUserId: string, limit?: number): Promise<Record<string, unknown>[]>; update(id: string, value: Record<string, unknown>): Promise<void>; }
export function createBookingsService(repository: BookingsRepository): BookingsService {
  return { create: (id, booking) => repository.create(id, booking), list: (hostUserId, limit) => repository.listForHost(hostUserId, undefined, limit), update: (id, value) => repository.update(id, value) };
}
