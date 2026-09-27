import crypto from 'node:crypto';

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

export interface CalendarTokenBundle {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface CalendarProviderAdapter {
  provider: CalendarProvider;
  isConfigured(): boolean;
  authorizeUrl(state: string): string;
  exchangeCode(code: string): Promise<CalendarTokenBundle>;
  refresh(bundle: CalendarTokenBundle): Promise<CalendarTokenBundle>;
  createEvent(bundle: CalendarTokenBundle, event: CalendarBookingEvent): Promise<{ externalEventId: string }>;
  cancelEvent(bundle: CalendarTokenBundle, externalEventId: string): Promise<void>;
}

function encryptionKey(): Buffer {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY || (process.env.NODE_ENV !== 'production' ? process.env.AUTH_SESSION_SECRET : '');
  if (!secret || secret.length < 32) throw new Error('INTEGRATION_ENCRYPTION_KEY_NOT_CONFIGURED');
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptCalendarTokens(bundle: CalendarTokenBundle): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(bundle), 'utf8'), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptCalendarTokens(value: string): CalendarTokenBundle {
  const [iv, tag, encrypted] = value.split('.');
  if (!iv || !tag || !encrypted) throw new Error('INVALID_CALENDAR_TOKEN_RECORD');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8')) as CalendarTokenBundle;
}

function config(provider: CalendarProvider) {
  return provider === 'google'
    ? { clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID || '', clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '', redirectUri: process.env.GOOGLE_CALENDAR_REDIRECT_URI || '', authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth', tokenEndpoint: 'https://oauth2.googleapis.com/token', scopes: ['https://www.googleapis.com/auth/calendar.events'] }
    : { clientId: process.env.MICROSOFT_CALENDAR_CLIENT_ID || '', clientSecret: process.env.MICROSOFT_CALENDAR_CLIENT_SECRET || '', redirectUri: process.env.MICROSOFT_CALENDAR_REDIRECT_URI || '', authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize', tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token', scopes: ['offline_access', 'Calendars.ReadWrite'] };
}

export function calendarProviderIsConfigured(provider: CalendarProvider): boolean {
  const value = config(provider);
  return Boolean(value.clientId && value.clientSecret && value.redirectUri);
}

export function calendarOAuthConfiguration(provider: CalendarProvider) {
  if (!calendarProviderIsConfigured(provider)) return null;
  const value = config(provider);
  return { authorizationEndpoint: value.authorizationEndpoint, clientId: value.clientId, redirectUri: value.redirectUri, scopes: value.scopes };
}

async function tokenRequest(provider: CalendarProvider, body: URLSearchParams): Promise<CalendarTokenBundle> {
  const value = config(provider);
  const response = await fetch(value.tokenEndpoint, { method: 'POST', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body });
  const payload = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok || typeof payload.access_token !== 'string') throw new Error(payload.error_description || payload.error || 'CALENDAR_TOKEN_EXCHANGE_FAILED');
  return { accessToken: payload.access_token, refreshToken: String(payload.refresh_token || ''), expiresAt: Date.now() + Number(payload.expires_in || 3600) * 1000 };
}

async function refreshToken(provider: CalendarProvider, bundle: CalendarTokenBundle): Promise<CalendarTokenBundle> {
  if (bundle.expiresAt > Date.now() + 60_000) return bundle;
  if (!bundle.refreshToken) throw new Error('CALENDAR_REAUTH_REQUIRED');
  const value = config(provider);
  const refreshed = await tokenRequest(provider, new URLSearchParams({ client_id: value.clientId, client_secret: value.clientSecret, refresh_token: bundle.refreshToken, grant_type: 'refresh_token' }));
  return { ...refreshed, refreshToken: refreshed.refreshToken || bundle.refreshToken };
}

async function jsonRequest(url: string, init: RequestInit): Promise<any> {
  const response = await fetch(url, { ...init, signal: init.signal || AbortSignal.timeout(10000) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || payload?.error_description || `CALENDAR_PROVIDER_${response.status}`);
  return payload;
}

export function calendarAdapter(provider: CalendarProvider): CalendarProviderAdapter {
  const value = config(provider);
  const google = provider === 'google';
  return {
    provider,
    isConfigured: () => calendarProviderIsConfigured(provider),
    authorizeUrl(state) {
      const url = new URL(value.authorizationEndpoint);
      url.searchParams.set('client_id', value.clientId);
      url.searchParams.set('redirect_uri', value.redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', value.scopes.join(' '));
      url.searchParams.set('state', state);
      if (google) { url.searchParams.set('access_type', 'offline'); url.searchParams.set('prompt', 'consent'); } else url.searchParams.set('response_mode', 'query');
      return url.toString();
    },
    exchangeCode(code) {
      return tokenRequest(provider, new URLSearchParams({ client_id: value.clientId, client_secret: value.clientSecret, code, redirect_uri: value.redirectUri, grant_type: 'authorization_code', ...(google ? {} : { scope: value.scopes.join(' ') }) }));
    },
    refresh: (bundle) => refreshToken(provider, bundle),
    async createEvent(bundle, event) {
      const token = await refreshToken(provider, bundle);
      if (google) {
        const payload = await jsonRequest('https://www.googleapis.com/calendar/v3/calendars/primary/events', { method: 'POST', headers: { Authorization: `Bearer ${token.accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: event.id.replace(/[^a-z0-9]/gi, '').slice(0, 40), summary: event.title, description: event.description, start: { dateTime: event.start, timeZone: event.timezone }, end: { dateTime: event.end, timeZone: event.timezone }, attendees: [{ email: event.attendeeEmail }] }) });
        return { externalEventId: String(payload.id) };
      }
      const payload = await jsonRequest('https://graph.microsoft.com/v1.0/me/events', { method: 'POST', headers: { Authorization: `Bearer ${token.accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: event.title, body: { contentType: 'text', content: event.description || '' }, start: { dateTime: event.start, timeZone: event.timezone }, end: { dateTime: event.end, timeZone: event.timezone }, attendees: [{ emailAddress: { address: event.attendeeEmail }, type: 'required' }] }) });
      return { externalEventId: String(payload.id) };
    },
    async cancelEvent(bundle, externalEventId) {
      const token = await refreshToken(provider, bundle);
      const url = google ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(externalEventId)}` : `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(externalEventId)}`;
      const response = await fetch(url, { method: 'DELETE', signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${token.accessToken}` } });
      if (!response.ok && response.status !== 404) throw new Error(`CALENDAR_CANCEL_${response.status}`);
    }
  };
}
