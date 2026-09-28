import assert from 'node:assert/strict';
import { inspectStagingEnvironment } from './server-config.mjs';

const valid = {
  NODE_ENV: 'production', APP_ENV: 'staging', SECRET_MANAGER_ENABLED: 'true', SECRET_MANAGER_PROJECT_ID: 'raloa-staging',
  APP_URL: 'https://staging.raloa.example', AUTH_SESSION_SECRET: 'a'.repeat(48),
  INTEGRATION_KMS_KEY_NAME: 'projects/raloa-staging/locations/global/keyRings/app/cryptoKeys/integrations',
  FIREBASE_PROJECT_ID: 'raloa-staging', FIRESTORE_DATABASE_ID: 'raloa-staging', FIREBASE_STORAGE_BUCKET: 'raloa-staging.firebasestorage.app', FIREBASE_ADMIN_ENABLED: 'true',
  POSTGRES_DATABASE_URL: 'postgresql://staging', POSTGRES_ENVIRONMENT: 'staging', POSTGRES_ENABLED: 'true', POSTGRES_SSL: 'true',
  STRIPE_SECRET_KEY: 'sk_test_staging', STRIPE_WEBHOOK_SECRET: 'whsec_staging', CLOUDFLARE_API_TOKEN: 'a'.repeat(40), CLOUDFLARE_ZONE_ID: 'a'.repeat(32),
  CLOUDFLARE_R2_ACCOUNT_ID: 'account', CLOUDFLARE_R2_BUCKET: 'raloa-staging-ci-media', CLOUDFLARE_R2_PUBLIC_BASE_URL: 'https://media-staging.raloa.example',
  CLOUD_TASKS_PROJECT_ID: 'raloa-staging', CLOUD_TASKS_LOCATION: 'europe-west1', CLOUD_TASKS_QUEUE: 'raloa-staging-ci-background', CLOUD_TASKS_WORKER_URL: 'https://worker-staging.raloa.example/tasks/background-jobs',
  SENTRY_DSN: 'https://example@sentry.io/1', RELEASE_ID: 'staging-1', GOOGLE_CALENDAR_CLIENT_ID: 'google', GOOGLE_CALENDAR_CLIENT_SECRET: 'google-secret', GOOGLE_CALENDAR_REDIRECT_URI: 'https://staging.raloa.example/api/calendar/google/callback',
  MICROSOFT_CALENDAR_CLIENT_ID: 'microsoft', MICROSOFT_CALENDAR_CLIENT_SECRET: 'microsoft-secret', MICROSOFT_CALENDAR_REDIRECT_URI: 'https://staging.raloa.example/api/calendar/microsoft/callback', RESEND_FROM_EMAIL: 'staging@raloa.example', RESEND_API_KEY: 'resend-secret',
  STAGING_RESOURCE_PREFIX: 'raloa-staging-ci', STAGING_STRIPE_MODE: 'test', CLOUDFLARE_R2_ACCESS_KEY_ID: 'key', CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'secret'
};

const validResult = inspectStagingEnvironment(valid);
assert.deepEqual(validResult.missing, []);
assert.deepEqual(validResult.invalid, []);

const productionResources = inspectStagingEnvironment({ ...valid, APP_URL: 'https://raloa.app', STRIPE_SECRET_KEY: 'sk_live_production', STAGING_STRIPE_MODE: 'live', CLOUD_TASKS_QUEUE: 'raloa-background' });
assert.ok(productionResources.invalid.some((message) => message.includes('production public domain')));
assert.ok(productionResources.invalid.some((message) => message.includes('Stripe test')));
assert.ok(productionResources.invalid.some((message) => message.includes('STAGING_RESOURCE_PREFIX')));

const missingProviders = inspectStagingEnvironment({ ...valid, SECRET_MANAGER_ENABLED: 'false', GOOGLE_CALENDAR_CLIENT_ID: '', MICROSOFT_CALENDAR_CLIENT_ID: '', RESEND_API_KEY: '' });
assert.ok(missingProviders.missing.includes('GOOGLE_CALENDAR_CLIENT_ID'));
assert.ok(missingProviders.missing.includes('RESEND_API_KEY'));
assert.ok(missingProviders.invalid.some((message) => message.includes('SECRET_MANAGER_ENABLED')));

console.log('PASS: staging configuration enforces isolated real-provider resources');
