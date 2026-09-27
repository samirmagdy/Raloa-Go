import { calendarAdapter, calendarProviderIsConfigured, type CalendarProvider } from '../../server-calendar';
import type { ExternalProvider } from '../domains/integrations';
import type { CalendarProviderAdapter } from '../../server-calendar';

export type GoogleCalendarAdapter = CalendarProviderAdapter & { provider: 'google' };
export type MicrosoftGraphCalendarAdapter = CalendarProviderAdapter & { provider: 'outlook' };

export function createGoogleCalendarAdapter(): GoogleCalendarAdapter {
  return calendarAdapter('google') as GoogleCalendarAdapter;
}

export function createMicrosoftGraphCalendarAdapter(): MicrosoftGraphCalendarAdapter {
  return calendarAdapter('outlook') as MicrosoftGraphCalendarAdapter;
}

export function calendarProviders(): ExternalProvider[] {
  return (['google', 'outlook'] as CalendarProvider[]).map((provider) => ({
    name: `${provider}-calendar`,
    isConfigured: () => calendarProviderIsConfigured(provider),
    adapter: provider === 'google' ? createGoogleCalendarAdapter() : createMicrosoftGraphCalendarAdapter()
  }));
}
