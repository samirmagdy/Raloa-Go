import type { BookingConfig } from '../../types';

export const DEFAULT_BOOKING_CONFIG: BookingConfig = {
  enabled: false,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  services: [{ id: 'consultation', name: 'Consultation', description: 'A focused session', durationMinutes: 60, bufferMinutes: 15 }],
  weeklyAvailability: {
    '0': { enabled: false, start: '09:00', end: '17:00' },
    '1': { enabled: true, start: '09:00', end: '17:00' },
    '2': { enabled: true, start: '09:00', end: '17:00' },
    '3': { enabled: true, start: '09:00', end: '17:00' },
    '4': { enabled: true, start: '09:00', end: '17:00' },
    '5': { enabled: true, start: '09:00', end: '17:00' },
    '6': { enabled: false, start: '09:00', end: '17:00' },
  },
  blackoutDates: [],
  minNoticeMinutes: 120,
  bookingWindowDays: 60,
  bufferMinutes: 15,
  maxBookingsPerDay: 20,
  calendarProvider: 'none',
};
