import * as Sentry from '@sentry/node';
import type { TelemetryContext } from './types';

let initialized = false;

export function initializeServerSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || initialized) return;
  Sentry.init({ dsn, environment: process.env.NODE_ENV || 'development', tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1) });
  initialized = true;
}

export function captureServerException(error: unknown, context: TelemetryContext = {}): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(context)) if (value) scope.setTag(key, String(value));
    Sentry.captureException(error);
  });
}
