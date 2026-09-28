import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const redact = (value: unknown, key = ''): unknown => {
  if (/(authorization|cookie|token|secret|password|credential|payload|body|email|payment|card|cvv|cvc)/i.test(key)) return '[REDACTED]';
  if (typeof value === 'string') return value.replace(/(Bearer\s+|sk_(?:live|test)_|whsec_)[A-Za-z0-9._-]+/g, '[REDACTED]').slice(0, 1000);
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 100).map(([childKey, childValue]) => [childKey, redact(childValue, childKey)]));
  return value;
};

if (dsn) Sentry.init({
  dsn,
  release: process.env.NEXT_PUBLIC_RELEASE_ID || 'local',
  environment: process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || 'development',
  tracesSampleRate: Math.min(1, Math.max(0, Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || 0.1))),
  sendDefaultPii: false,
  beforeSend(event) {
    event.request = undefined;
    event.user = undefined;
    if (event.extra) event.extra = redact(event.extra) as Record<string, unknown>;
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
