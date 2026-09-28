import type { CalendarBookingEvent, CalendarProvider as CalendarProviderName, CalendarTokenBundle } from '../../../server-calendar';

/** Provider-neutral calendar port. Google and Microsoft details stay in adapters. */
export interface CalendarProvider {
  readonly provider: CalendarProviderName;
  isConfigured(): boolean;
  authorizeUrl(state: string): string;
  exchangeCode(code: string): Promise<CalendarTokenBundle>;
  refresh(bundle: CalendarTokenBundle): Promise<CalendarTokenBundle>;
  createEvent(bundle: CalendarTokenBundle, event: CalendarBookingEvent): Promise<{ externalEventId: string }>;
  updateEvent(bundle: CalendarTokenBundle, externalEventId: string, event: CalendarBookingEvent): Promise<void>;
  cancelEvent(bundle: CalendarTokenBundle, externalEventId: string): Promise<void>;
}
