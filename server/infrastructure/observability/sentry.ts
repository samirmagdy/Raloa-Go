import * as Sentry from '@sentry/node';
import type { TelemetryContext } from './types';

let initialized = false;

export function initializeServerSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || initialized) return;
  const tracesSampleRate = Math.min(1, Math.max(0, Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1)));
  Sentry.init({
    dsn,
    environment: process.env.APP_ENV || process.env.NODE_ENV || 'development',
    release: process.env.RELEASE_ID || process.env.K_REVISION || 'local',
    tracesSampleRate,
    beforeSend(event) {
      // Do not forward request bodies, cookies, authorization headers, user
      // identities, or provider payloads from the server error boundary.
      event.request = undefined;
      event.user = undefined;
      if (event.extra) event.extra = redactSentryObject(event.extra) as Record<string, unknown>;
      if (event.contexts) event.contexts = redactSentryObject(event.contexts) as typeof event.contexts;
      if (event.exception?.values) {
        event.exception.values = event.exception.values.map((value) => ({
          ...value,
          value: typeof value.value === 'string' ? String(redactSentryObject(value.value)) : value.value
        }));
      }
      return event;
    }
  });
  initialized = true;
}

const SENSITIVE_KEY = /(authorization|cookie|token|secret|password|credential|raw.?event|payload|body|email|payment|card|cvv|cvc)/i;
const SECRET_VALUE = /(sk_(?:live|test)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|AIza[A-Za-z0-9_-]+|Bearer\s+[A-Za-z0-9._-]+|-----BEGIN [A-Z ]+ PRIVATE KEY-----)/g;

function redactSentryObject(value: unknown, key = ''): unknown {
  if (SENSITIVE_KEY.test(key)) return '[REDACTED]';
  if (typeof value === 'string') return value.replace(SECRET_VALUE, '[REDACTED]').slice(0, 1000);
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redactSentryObject(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 100).map(([childKey, childValue]) => [childKey, redactSentryObject(childValue, childKey)]));
  }
  return value;
}

export function captureServerException(error: unknown, context: TelemetryContext = {}): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(context)) if (value && !SENSITIVE_KEY.test(key)) scope.setTag(key, String(value).slice(0, 200));
    Sentry.captureException(error instanceof Error ? error : new Error(String(error || 'Unknown error')));
  });
}

export function startServerRequestSpan(input: { method: string; path: string; requestId?: string }): (() => void) {
  if (!initialized) return () => undefined;
  const api = Sentry as typeof Sentry & { startInactiveSpan?: (options: Record<string, unknown>) => { setAttribute?: (key: string, value: string | number) => void; end: () => void } };
  const span = api.startInactiveSpan?.({ op: 'http.server', name: `${input.method} ${normalizeRoutePath(input.path)}`, attributes: { 'raloa.request_id': input.requestId || '' } });
  return () => span?.end();
}

export function normalizeRoutePath(pathname: string): string {
  return pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id').replace(/\/\d+(?=\/|$)/g, '/:id').replace(/\/@[a-z0-9_-]+/gi, '/@:handle');
}
