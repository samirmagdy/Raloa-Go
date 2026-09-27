export type CalendarProvider = 'google' | 'outlook';

export interface CalendarBookingEvent {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  timezone: string;
  attendeeEmail: string;
}

export interface CalendarProviderAdapter {
  provider: CalendarProvider;
  isConfigured(): boolean;
  createEvent(event: CalendarBookingEvent): Promise<{ externalEventId: string }>;
  cancelEvent(externalEventId: string): Promise<void>;
}

/**
 * Provider seam for the durable calendar_jobs outbox. Tokens must be stored
 * server-side after OAuth; they are intentionally never sent to the browser.
 * Concrete Google/Outlook adapters can be enabled independently of booking writes.
 */
export function calendarProviderIsConfigured(provider: CalendarProvider): boolean {
  if (provider === 'google') return Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID && process.env.GOOGLE_CALENDAR_CLIENT_SECRET && process.env.GOOGLE_CALENDAR_REDIRECT_URI);
  return Boolean(process.env.MICROSOFT_CALENDAR_CLIENT_ID && process.env.MICROSOFT_CALENDAR_CLIENT_SECRET && process.env.MICROSOFT_CALENDAR_REDIRECT_URI);
}

export function calendarOAuthConfiguration(provider: CalendarProvider) {
  if (!calendarProviderIsConfigured(provider)) return null;
  return provider === 'google'
    ? {
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
        redirectUri: process.env.GOOGLE_CALENDAR_REDIRECT_URI!,
        scopes: ['https://www.googleapis.com/auth/calendar.events']
      }
    : {
        authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        clientId: process.env.MICROSOFT_CALENDAR_CLIENT_ID!,
        redirectUri: process.env.MICROSOFT_CALENDAR_REDIRECT_URI!,
        scopes: ['offline_access', 'Calendars.ReadWrite']
      };
}
