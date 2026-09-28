export async function register() {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const Sentry = await import('@sentry/nextjs');
  Sentry.init({
    dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
    sendDefaultPii: false,
    release: process.env.RELEASE_ID || process.env.K_REVISION || 'local',
    beforeSend(event) {
      event.request = undefined;
      event.user = undefined;
      if (event.extra) {
        for (const key of Object.keys(event.extra)) if (/(authorization|cookie|token|secret|password|credential|payload|body|email|payment|card|cvv|cvc)/i.test(key)) event.extra[key] = '[REDACTED]';
      }
      return event;
    },
  });
}

export async function onRequestError(error: unknown, request: unknown, context: unknown) {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const Sentry = await import('@sentry/nextjs');
  Sentry.withScope((scope) => {
    const headers = (request as { headers?: { get?: (name: string) => string | null } })?.headers;
    const requestId = headers?.get?.('x-request-id');
    if (requestId) scope.setTag('requestId', requestId);
    scope.setTag('environment', process.env.APP_ENV || process.env.NODE_ENV || 'development');
    Sentry.captureException(error instanceof Error ? error : new Error(String(error || 'Next request failed')));
  });
  void context;
}
