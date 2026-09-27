import type { Firestore } from 'firebase-admin/firestore';
import { firestoreRepository } from '../../infrastructure/firestore-repository';
import type { DomainModule, Repository } from '../../core/types';
export interface BookingRecord { [key: string]: unknown }
export interface BookingsModule extends DomainModule { repository: Repository<BookingRecord>; }
export function createBookingsModule(db: Firestore): BookingsModule {
  return { name: 'bookings', routes: ['/api/v1/public/bookings', '/api/creator/bookings'], repository: firestoreRepository(db, 'bookings') };
}
