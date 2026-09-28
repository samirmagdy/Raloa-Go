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

export type FirebaseAuthBrowserConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
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

/** Validates only the Firebase Auth values that are safe to expose in a browser bundle. */
export function parseFirebaseAuthBrowserConfig(env: Record<string, string | undefined>, strict = false): FirebaseAuthBrowserConfig | undefined {
  const names = ['NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_APP_ID'] as const;
  const values = names.map((name) => env[name]?.trim());
  if (!strict && values.every((value) => !value)) return undefined;
  if (values.some((value) => !value)) throw new Error(`Firebase Auth browser configuration requires ${names.join(', ')}`);
  return { apiKey: values[0]!, authDomain: values[1]!, projectId: values[2]!, appId: values[3]! };
}

export function readRuntimeEnvironment(value = process.env.NODE_ENV): RuntimeEnvironment {
  const environment = String(value || 'development');
  if (environment === 'production' || environment === 'staging' || environment === 'test') return environment;
  return 'development';
}
