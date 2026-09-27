import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

/**
 * Secrets are loaded once during server bootstrap. The rest of the application
 * may continue using its existing configuration seam, but production values
 * come from Secret Manager instead of a dotenv file or deployment manifest.
 */
export const MANAGED_SECRET_ENV_NAMES = Object.freeze([
  'AUTH_SESSION_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'CLOUDFLARE_API_TOKEN',
  'GOOGLE_CALENDAR_CLIENT_SECRET',
  'MICROSOFT_CALENDAR_CLIENT_SECRET',
  'GITHUB_CLIENT_SECRET',
  'RESEND_API_KEY'
] as const);

type ManagedSecretName = (typeof MANAGED_SECRET_ENV_NAMES)[number];
export interface SecretAccessClient {
  accessSecretVersion(request: { name: string }): Promise<unknown>;
}

function enabled(env: NodeJS.ProcessEnv): boolean {
  return env.SECRET_MANAGER_ENABLED === 'true';
}

function secretName(env: NodeJS.ProcessEnv, key: ManagedSecretName): string {
  const configured = env[`SECRET_MANAGER_SECRET_${key}`];
  return configured?.trim() || key;
}

export async function loadProductionSecrets(
  env: NodeJS.ProcessEnv = process.env,
  client: SecretAccessClient = new SecretManagerServiceClient()
): Promise<void> {
  if (!enabled(env)) return;
  const projectId = env.SECRET_MANAGER_PROJECT_ID || env.GOOGLE_CLOUD_PROJECT || env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('SECRET_MANAGER_PROJECT_ID_NOT_CONFIGURED');

  for (const key of MANAGED_SECRET_ENV_NAMES) {
    try {
      const response = await client.accessSecretVersion({ name: `projects/${projectId}/secrets/${secretName(env, key)}/versions/latest` });
      const version = (response as [{ payload?: { data?: string | Uint8Array | null } }])[0];
      const value = version.payload?.data;
      if (!value) throw new Error('empty secret');
      env[key] = typeof value === 'string' ? value : Buffer.from(value as Uint8Array).toString('utf8');
    } catch {
      throw new Error(`SECRET_MANAGER_SECRET_UNAVAILABLE:${key}`);
    }
  }
  const legacySecretName = env.SECRET_MANAGER_SECRET_INTEGRATION_LEGACY_ENCRYPTION_KEY;
  if (legacySecretName) {
    try {
      const response = await client.accessSecretVersion({ name: `projects/${projectId}/secrets/${legacySecretName}/versions/latest` });
      const version = (response as [{ payload?: { data?: string | Uint8Array | null } }])[0];
      const value = version.payload?.data;
      if (!value) throw new Error('empty secret');
      env.INTEGRATION_LEGACY_ENCRYPTION_KEY = typeof value === 'string' ? value : Buffer.from(value).toString('utf8');
    } catch {
      throw new Error('SECRET_MANAGER_LEGACY_ENCRYPTION_SECRET_UNAVAILABLE');
    }
  }
}

export function isManagedSecretEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return enabled(env);
}
