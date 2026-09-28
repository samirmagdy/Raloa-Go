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
  'RESEND_API_KEY',
  'POSTGRES_DATABASE_URL',
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY'
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

  const secretNames = MANAGED_SECRET_ENV_NAMES.filter((key) => {
    if (key === 'POSTGRES_DATABASE_URL') return env.POSTGRES_ENABLED === 'true';
    if (key === 'CLOUDFLARE_R2_ACCESS_KEY_ID' || key === 'CLOUDFLARE_R2_SECRET_ACCESS_KEY') return env.MEDIA_R2_AUTHORITATIVE === 'true';
    return true;
  });
  for (const key of secretNames) {
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
