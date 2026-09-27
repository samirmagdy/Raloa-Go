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

export function readRuntimeEnvironment(value = process.env.NODE_ENV): RuntimeEnvironment {
  if (value === 'production' || value === 'staging' || value === 'test') return value;
  return 'development';
}

