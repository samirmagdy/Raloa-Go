export type RuntimeEnvironment = 'development' | 'test' | 'staging' | 'production';

export type AppConfig = {
  environment: RuntimeEnvironment;
  apiOrigin: string;
  firebaseProjectId?: string;
  postgresUrl?: string;
  cloudTasksProjectId?: string;
  stripeSecretKey?: string;
  sentryDsn?: string;
};

export type WebConfig = {
  appUrl: string;
  apiUrl: string;
  defaultLocale: 'en' | 'ar';
  sentryDsn?: string;
};

function requiredUrl(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`);
  try {
    return new URL(value).toString().replace(/\/$/, '');
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
}

/** Validates only server-safe web configuration. Secrets are never accepted here. */
export function parseWebConfig(env: Record<string, string | undefined>): WebConfig {
  const locale = env.NEXT_PUBLIC_DEFAULT_LOCALE || 'en';
  if (locale !== 'en' && locale !== 'ar') throw new Error('NEXT_PUBLIC_DEFAULT_LOCALE must be en or ar');
  return {
    appUrl: requiredUrl(env.NEXT_PUBLIC_APP_URL, 'NEXT_PUBLIC_APP_URL'),
    apiUrl: requiredUrl(env.NEXT_PUBLIC_API_URL, 'NEXT_PUBLIC_API_URL'),
    defaultLocale: locale,
    sentryDsn: env.NEXT_PUBLIC_SENTRY_DSN || undefined,
  };
}

export function readRuntimeEnvironment(value = process.env.NODE_ENV): RuntimeEnvironment {
  const environment = String(value || 'development');
  if (environment === 'production' || environment === 'staging' || environment === 'test') return environment;
  return 'development';
}
