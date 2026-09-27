import type { BookingsRepository } from '../../repositories/contracts';
import { assertBookingDoesNotConflict } from '../../core/domain-invariants';
export interface BookingsService { create(id: string, booking: Record<string, unknown>): Promise<void>; list(hostUserId: string, limit?: number): Promise<Record<string, unknown>[]>; update(id: string, value: Record<string, unknown>): Promise<void>; }
export function createBookingsService(repository: BookingsRepository): BookingsService {
  return {
    async create(id, booking) {
      if (typeof booking.hostUserId === 'string' && typeof booking.slotStart === 'string' && typeof booking.slotEnd === 'string') {
        const existing = await repository.listForHost(String(booking.hostUserId), typeof booking.siteId === 'string' ? booking.siteId : undefined, 500);
        assertBookingDoesNotConflict({ startsAt: booking.slotStart, endsAt: booking.slotEnd, status: String(booking.status || 'pending') }, existing.map((item) => ({ startsAt: String(item.slotStart || item.startsAt || ''), endsAt: String(item.slotEnd || item.endsAt || ''), status: String(item.status || 'pending') })));
      }
      await repository.create(id, booking);
    },
    list: (hostUserId, limit) => repository.listForHost(hostUserId, undefined, limit),
    update: (id, value) => repository.update(id, value)
  };
}
