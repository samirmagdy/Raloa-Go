import fs from 'node:fs';

export const REQUIRED_PRODUCTION_VARIABLES = Object.freeze([
  'APP_URL', 'AUTH_SESSION_SECRET', 'INTEGRATION_KMS_KEY_NAME',
  'FIREBASE_PROJECT_ID', 'FIRESTORE_DATABASE_ID', 'FIREBASE_STORAGE_BUCKET', 'FIREBASE_ADMIN_ENABLED',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_PRO_MONTHLY', 'STRIPE_PRICE_PRO_YEARLY',
  'STRIPE_PRICE_STUDIO_MONTHLY', 'STRIPE_PRICE_STUDIO_YEARLY', 'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ZONE_ID', 'TRUSTED_PROXY_HOPS', 'CLOUD_TASKS_PROJECT_ID', 'CLOUD_TASKS_LOCATION',
  'CLOUD_TASKS_QUEUE', 'CLOUD_TASKS_WORKER_URL'
]);

export const MANAGED_PRODUCTION_SECRETS = Object.freeze([
  'AUTH_SESSION_SECRET', 'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET', 'CLOUDFLARE_API_TOKEN', 'GOOGLE_CALENDAR_CLIENT_SECRET',
  'MICROSOFT_CALENDAR_CLIENT_SECRET', 'GITHUB_CLIENT_SECRET', 'RESEND_API_KEY', 'POSTGRES_DATABASE_URL',
  'CLOUDFLARE_R2_ACCESS_KEY_ID', 'CLOUDFLARE_R2_SECRET_ACCESS_KEY'
]);

export const OPTIONAL_PRODUCTION_VARIABLES = Object.freeze([
  'GEMINI_API_KEY', 'VITE_ANALYTICS_ENDPOINT', 'SENTRY_DSN', 'RESEND_API_KEY', 'RESEND_FROM_EMAIL',
  'GOOGLE_CALENDAR_CLIENT_ID', 'GOOGLE_CALENDAR_CLIENT_SECRET', 'GOOGLE_CALENDAR_REDIRECT_URI',
  'MICROSOFT_CALENDAR_CLIENT_ID', 'MICROSOFT_CALENDAR_CLIENT_SECRET', 'MICROSOFT_CALENDAR_REDIRECT_URI',
  'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_OAUTH_REDIRECT_URI'
]);

export const REQUIRED_STAGING_VARIABLES = Object.freeze([
  'APP_URL', 'AUTH_SESSION_SECRET', 'INTEGRATION_KMS_KEY_NAME',
  'FIREBASE_PROJECT_ID', 'FIRESTORE_DATABASE_ID', 'FIREBASE_STORAGE_BUCKET', 'FIREBASE_ADMIN_ENABLED',
  'POSTGRES_DATABASE_URL', 'POSTGRES_ENVIRONMENT', 'POSTGRES_ENABLED', 'POSTGRES_SSL',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
  'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ZONE_ID',
  'CLOUDFLARE_R2_ACCOUNT_ID', 'CLOUDFLARE_R2_BUCKET', 'CLOUDFLARE_R2_PUBLIC_BASE_URL',
  'CLOUDFLARE_R2_ACCESS_KEY_ID', 'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
  'CLOUD_TASKS_PROJECT_ID', 'CLOUD_TASKS_LOCATION', 'CLOUD_TASKS_QUEUE', 'CLOUD_TASKS_WORKER_URL',
  'SENTRY_DSN', 'RELEASE_ID', 'GOOGLE_CALENDAR_CLIENT_ID', 'GOOGLE_CALENDAR_REDIRECT_URI',
  'MICROSOFT_CALENDAR_CLIENT_ID', 'MICROSOFT_CALENDAR_REDIRECT_URI', 'RESEND_FROM_EMAIL', 'RESEND_API_KEY',
  'STAGING_RESOURCE_PREFIX', 'STAGING_STRIPE_MODE'
]);

const isPresent = (value) => typeof value === 'string' && value.trim().length > 0;
const isPlaceholder = (value) => /^(MY_|GENERATE_|CHANGE_ME|replace[-_]|your[-_]|price_\.\.\.|sk_(test|live)_\.\.\.|whsec_\.\.\.)/i.test(String(value || '').trim());

export function inspectProductionEnvironment(env = process.env) {
  const secretManagerEnabled = env.SECRET_MANAGER_ENABLED === 'true';
  const missing = REQUIRED_PRODUCTION_VARIABLES.filter((name) => !(secretManagerEnabled && MANAGED_PRODUCTION_SECRETS.includes(name)) && !isPresent(env[name]));
  const invalid = [];
  const optionalMissing = OPTIONAL_PRODUCTION_VARIABLES.filter((name) => !isPresent(env[name]));

  if (env.NODE_ENV !== 'production') invalid.push('NODE_ENV must be exactly production for production validation');
  if (env.NODE_ENV === 'production' && !secretManagerEnabled) invalid.push('SECRET_MANAGER_ENABLED must be true in production; raw production secrets in generic environment variables are not supported');
  if (isPresent(env.APP_URL)) {
    try {
      const url = new URL(env.APP_URL);
      if (url.protocol !== 'https:') invalid.push('APP_URL must use https:// in production');
      if (url.pathname !== '/' || url.search || url.hash) invalid.push('APP_URL must be an origin without a path, query, or hash');
      if (['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)) invalid.push('APP_URL cannot point to a local or wildcard host');
    } catch { invalid.push('APP_URL must be a valid absolute HTTPS URL'); }
  }
  if (isPresent(env.AUTH_SESSION_SECRET)) {
    if (env.AUTH_SESSION_SECRET.length < 32) invalid.push('AUTH_SESSION_SECRET must be at least 32 characters');
    if (isPlaceholder(env.AUTH_SESSION_SECRET) || /local-development|development-secret|change[-_]?me/i.test(env.AUTH_SESSION_SECRET)) invalid.push('AUTH_SESSION_SECRET must be a unique production secret, not a placeholder');
  }
  if (isPresent(env.INTEGRATION_ENCRYPTION_KEY)) {
    if (env.INTEGRATION_ENCRYPTION_KEY.length < 32) invalid.push('INTEGRATION_ENCRYPTION_KEY must be at least 32 characters');
    if (isPlaceholder(env.INTEGRATION_ENCRYPTION_KEY)) invalid.push('INTEGRATION_ENCRYPTION_KEY must be a unique production secret, not a placeholder');
  }
  if (isPresent(env.INTEGRATION_KMS_KEY_NAME) && !/^projects\/[^/]+\/locations\/[^/]+\/keyRings\/[^/]+\/cryptoKeys\/[^/]+(?:\/cryptoKeyVersions\/[^/]+)?$/.test(env.INTEGRATION_KMS_KEY_NAME)) invalid.push('INTEGRATION_KMS_KEY_NAME must be a valid Cloud KMS crypto key resource');
  if (isPresent(env.TRUSTED_PROXY_HOPS) && (!/^\d+$/.test(env.TRUSTED_PROXY_HOPS) || Number(env.TRUSTED_PROXY_HOPS) > 10)) invalid.push('TRUSTED_PROXY_HOPS must be an integer from 0 to 10');
  if (env.FIREBASE_ADMIN_ENABLED !== 'true') invalid.push('FIREBASE_ADMIN_ENABLED must be true in production');
  if (!isPresent(env.K_SERVICE) && !isPresent(env.GOOGLE_APPLICATION_CREDENTIALS)) invalid.push('Firebase Admin credentials are missing: set K_SERVICE on Cloud Run or GOOGLE_APPLICATION_CREDENTIALS');
  if (isPresent(env.GOOGLE_APPLICATION_CREDENTIALS) && !fs.existsSync(env.GOOGLE_APPLICATION_CREDENTIALS)) invalid.push('GOOGLE_APPLICATION_CREDENTIALS points to a file that does not exist');
  for (const name of ['FIREBASE_PROJECT_ID', 'FIRESTORE_DATABASE_ID', 'FIREBASE_STORAGE_BUCKET']) if (isPlaceholder(env[name])) invalid.push(`${name} must not use a placeholder value`);
  if (isPresent(env.STRIPE_SECRET_KEY) && !/^sk_live_[A-Za-z0-9]/.test(env.STRIPE_SECRET_KEY)) invalid.push('STRIPE_SECRET_KEY must be a live Stripe secret (sk_live_...) in production');
  if (isPresent(env.STRIPE_WEBHOOK_SECRET) && !/^whsec_[A-Za-z0-9]/.test(env.STRIPE_WEBHOOK_SECRET)) invalid.push('STRIPE_WEBHOOK_SECRET must be a valid Stripe webhook secret (whsec_...)');
  for (const name of ['STRIPE_PRICE_PRO_MONTHLY', 'STRIPE_PRICE_PRO_YEARLY', 'STRIPE_PRICE_STUDIO_MONTHLY', 'STRIPE_PRICE_STUDIO_YEARLY']) if (isPresent(env[name]) && (!/^price_[A-Za-z0-9]/.test(env[name]) || isPlaceholder(env[name]))) invalid.push(`${name} must be a real Stripe price ID`);
  if (isPresent(env.CLOUDFLARE_ZONE_ID) && !/^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_ZONE_ID)) invalid.push('CLOUDFLARE_ZONE_ID must be a 32-character Cloudflare zone ID');
  if (isPresent(env.CLOUDFLARE_API_TOKEN) && (env.CLOUDFLARE_API_TOKEN.length < 20 || isPlaceholder(env.CLOUDFLARE_API_TOKEN))) invalid.push('CLOUDFLARE_API_TOKEN must be a real scoped API token');

  const providerGroups = [
    ['Google Calendar', ['GOOGLE_CALENDAR_CLIENT_ID', 'GOOGLE_CALENDAR_CLIENT_SECRET', 'GOOGLE_CALENDAR_REDIRECT_URI']],
    ['Microsoft Calendar', ['MICROSOFT_CALENDAR_CLIENT_ID', 'MICROSOFT_CALENDAR_CLIENT_SECRET', 'MICROSOFT_CALENDAR_REDIRECT_URI']],
    ['GitHub social integration', ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_OAUTH_REDIRECT_URI']]
  ];
  for (const [label, names] of providerGroups) {
    const configured = names.filter((name) => isPresent(env[name])).length;
    if (configured > 0 && configured < names.length) invalid.push(`${label} configuration is incomplete; set all of ${names.join(', ')}`);
  }
  if (isPresent(env.RESEND_FROM_EMAIL) && !isPresent(env.RESEND_API_KEY)) invalid.push('RESEND_FROM_EMAIL requires RESEND_API_KEY');
  return { missing, invalid, optionalMissing };
}

export function assertProductionEnvironment(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  if (env.APP_ENV === 'staging') {
    const result = inspectStagingEnvironment(env);
    if (result.missing.length || result.invalid.length) {
      const details = [result.missing.length ? `missing: ${result.missing.join(', ')}` : '', ...result.invalid.map((message) => `invalid: ${message}`)].filter(Boolean).join('; ');
      throw new Error(`[staging-config] Startup blocked. ${details}`);
    }
    return;
  }
  const result = inspectProductionEnvironment(env);
  if (result.missing.length || result.invalid.length) {
    const details = [result.missing.length ? `missing: ${result.missing.join(', ')}` : '', ...result.invalid.map((message) => `invalid: ${message}`)].filter(Boolean).join('; ');
    throw new Error(`[production-config] Startup blocked. ${details}`);
  }
}

function stagingManagedOrPresent(env, name) {
  return isPresent(env[name]) || (env.SECRET_MANAGER_ENABLED === 'true' && isPresent(env.SECRET_MANAGER_PROJECT_ID));
}

export function inspectStagingEnvironment(env = process.env) {
  const missing = REQUIRED_STAGING_VARIABLES.filter((name) => {
    if (['AUTH_SESSION_SECRET', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_R2_ACCESS_KEY_ID', 'CLOUDFLARE_R2_SECRET_ACCESS_KEY', 'GOOGLE_CALENDAR_CLIENT_SECRET', 'MICROSOFT_CALENDAR_CLIENT_SECRET', 'RESEND_API_KEY'].includes(name)) return !stagingManagedOrPresent(env, name);
    return !isPresent(env[name]);
  });
  const invalid = [];
  if (env.NODE_ENV !== 'production') invalid.push('NODE_ENV must be production for the staging runtime');
  if (env.APP_ENV !== 'staging') invalid.push('APP_ENV must be staging');
  if (env.SECRET_MANAGER_ENABLED !== 'true') invalid.push('SECRET_MANAGER_ENABLED must be true for staging provider credentials');
  if (isPresent(env.APP_URL)) {
    try {
      const url = new URL(env.APP_URL);
      if (url.protocol !== 'https:') invalid.push('APP_URL must use https:// in staging');
      if (url.hostname === 'raloa.app' || url.hostname.endsWith('.raloa.app') && !url.hostname.startsWith('staging.')) invalid.push('APP_URL must not point at the production public domain');
    } catch { invalid.push('APP_URL must be a valid absolute HTTPS URL'); }
  }
  if (env.FIREBASE_ADMIN_ENABLED !== 'true') invalid.push('FIREBASE_ADMIN_ENABLED must be true in staging');
  if (env.POSTGRES_ENVIRONMENT !== 'staging') invalid.push('POSTGRES_ENVIRONMENT must be staging');
  if (env.POSTGRES_ENABLED !== 'true') invalid.push('POSTGRES_ENABLED must be true in staging');
  if (env.POSTGRES_SSL !== 'true') invalid.push('POSTGRES_SSL must be true in staging');
  if (env.STAGING_STRIPE_MODE !== 'test') invalid.push('STAGING_STRIPE_MODE must be test');
  if (isPresent(env.STRIPE_SECRET_KEY) && !/^sk_test_[A-Za-z0-9]/.test(env.STRIPE_SECRET_KEY)) invalid.push('STRIPE_SECRET_KEY must be a Stripe test secret in staging');
  if (isPresent(env.CLOUDFLARE_ZONE_ID) && !/^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_ZONE_ID)) invalid.push('CLOUDFLARE_ZONE_ID must be a 32-character Cloudflare zone ID');
  if (isPresent(env.STAGING_RESOURCE_PREFIX) && !/^raloa-staging-[a-z0-9-]+$/.test(env.STAGING_RESOURCE_PREFIX)) invalid.push('STAGING_RESOURCE_PREFIX must start with raloa-staging-');
  for (const [name, value] of [['CLOUD_TASKS_QUEUE', env.CLOUD_TASKS_QUEUE], ['CLOUDFLARE_R2_BUCKET', env.CLOUDFLARE_R2_BUCKET]]) {
    if (isPresent(value) && !value.startsWith(env.STAGING_RESOURCE_PREFIX || 'raloa-staging-')) invalid.push(`${name} must use STAGING_RESOURCE_PREFIX`);
  }
  if (isPresent(env.CLOUDFLARE_R2_PUBLIC_BASE_URL)) {
    try { if (new URL(env.CLOUDFLARE_R2_PUBLIC_BASE_URL).protocol !== 'https:') invalid.push('CLOUDFLARE_R2_PUBLIC_BASE_URL must use https://'); } catch { invalid.push('CLOUDFLARE_R2_PUBLIC_BASE_URL must be a valid URL'); }
  }
  const providerGroups = [
    ['Google Calendar', ['GOOGLE_CALENDAR_CLIENT_ID', 'GOOGLE_CALENDAR_CLIENT_SECRET', 'GOOGLE_CALENDAR_REDIRECT_URI']],
    ['Microsoft Calendar', ['MICROSOFT_CALENDAR_CLIENT_ID', 'MICROSOFT_CALENDAR_CLIENT_SECRET', 'MICROSOFT_CALENDAR_REDIRECT_URI']]
  ];
  for (const [label, names] of providerGroups) {
    const configured = names.filter((name) => stagingManagedOrPresent(env, name)).length;
    if (configured < names.length) invalid.push(`${label} configuration is incomplete`);
  }
  if (!stagingManagedOrPresent(env, 'RESEND_API_KEY')) invalid.push('RESEND_API_KEY must be configured through Secret Manager');
  return { missing, invalid };
}
