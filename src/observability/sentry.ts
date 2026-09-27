import * as Sentry from '@sentry/react';

let initialized = false;

export function initializeFrontendSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || initialized) return;
  Sentry.init({ dsn, environment: import.meta.env.MODE, tracesSampleRate: 0.1, integrations: [] });
  initialized = true;
}

export function captureFrontendException(error: unknown, context: Record<string, string> = {}): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(context)) scope.setTag(key, value);
    Sentry.captureException(error);
  });
}
