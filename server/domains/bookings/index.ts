import type { Firestore } from 'firebase-admin/firestore';
import type { DomainModule } from '../../core/types';
import { createBookingsService, type BookingsService } from './service';
import { createFirestoreBookingsRepository } from '../../repositories/firestore';
import type { BookingsRepository } from '../../repositories/contracts';
export interface BookingRecord { [key: string]: unknown }
export interface BookingsModule extends DomainModule { repository: BookingsRepository; service: BookingsService; }
export function createBookingsModule(db: Firestore): BookingsModule {
  const repository = createFirestoreBookingsRepository(db);
  return { name: 'bookings', routes: ['/api/v1/public/bookings', '/api/creator/bookings'], repository, service: createBookingsService(repository) };
}
