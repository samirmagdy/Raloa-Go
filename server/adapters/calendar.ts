import { calendarAdapter, calendarProviderIsConfigured, type CalendarProvider } from '../../server-calendar';
import type { ExternalProvider } from '../domains/integrations';

export function calendarProviders(): ExternalProvider[] {
  return (['google', 'outlook'] as CalendarProvider[]).map((provider) => ({
    name: `${provider}-calendar`,
    isConfigured: () => calendarProviderIsConfigured(provider),
    adapter: calendarAdapter(provider)
  }));
}
