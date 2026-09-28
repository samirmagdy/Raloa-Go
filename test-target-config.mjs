import assert from 'node:assert/strict';
import { inspectTargetEnvironment } from './server-config.mjs';

const valid = {
  NODE_ENV: 'production', APP_ENV: 'staging', APP_URL: 'https://staging.example.test', RELEASE_ID: 'release-1', TRUSTED_PROXY_HOPS: '1',
  POSTGRES_ENABLED: 'true', POSTGRES_DATABASE_URL: 'postgresql://db/app', POSTGRES_SSL: 'true', POSTGRES_POOL_MAX: '10', POSTGRES_POOL_MIN: '1', POSTGRES_CONNECTION_TIMEOUT_MS: '5000', POSTGRES_IDLE_TIMEOUT_MS: '10000',
  FIREBASE_PROJECT_ID: 'staging-project', FIREBASE_ADMIN_ENABLED: 'true', FIREBASE_ADMIN_CREDENTIAL_MODE: 'workload_identity', K_SERVICE: 'raloa-api',
  CLOUDFLARE_R2_ACCOUNT_ID: 'a'.repeat(32), CLOUDFLARE_R2_BUCKET: 'raloa-staging-media', CLOUDFLARE_R2_ENDPOINT: 'https://r2.example.test', CLOUDFLARE_R2_ACCESS_KEY_ID: 'access', CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'secret', CLOUDFLARE_R2_PUBLIC_BASE_URL: 'https://cdn.example.test',
  CLOUDFLARE_API_TOKEN: 'cloudflare-token', CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
  STRIPE_SECRET_KEY: 'sk_test_abc', STRIPE_WEBHOOK_SECRET: 'whsec_abc', STRIPE_PRICE_PRO_MONTHLY: 'price_pro_m', STRIPE_PRICE_PRO_YEARLY: 'price_pro_y', STRIPE_PRICE_STUDIO_MONTHLY: 'price_studio_m', STRIPE_PRICE_STUDIO_YEARLY: 'price_studio_y',
  CLOUD_TASKS_PROJECT_ID: 'project', CLOUD_TASKS_LOCATION: 'europe-west1', CLOUD_TASKS_QUEUE: 'raloa-staging', CLOUD_TASKS_WORKER_URL: 'https://worker.example.test', CLOUD_TASKS_SERVICE_ACCOUNT: 'worker@project.iam.gserviceaccount.com',
  SENTRY_DSN: 'https://public@example.ingest.sentry.io/1', INTEGRATION_KMS_KEY_NAME: 'projects/p/locations/l/keyRings/r/cryptoKeys/k', AUTH_SESSION_SECRET: 'x'.repeat(40),
};

let result = inspectTargetEnvironment(valid, 'api');
assert.deepEqual(result.missing, []);
assert.deepEqual(result.invalid, []);

result = inspectTargetEnvironment({ ...valid, POSTGRES_DATABASE_URL: undefined }, 'api');
assert.ok(result.missing.includes('POSTGRES_DATABASE_URL'));

result = inspectTargetEnvironment({ ...valid, NEXT_PUBLIC_STRIPE_SECRET_KEY: 'nope' }, 'api');
assert.ok(result.invalid.some((message) => message.includes('NEXT_PUBLIC_STRIPE_SECRET_KEY')));

result = inspectTargetEnvironment({ ...valid, CLOUD_TASKS_SERVICE_ACCOUNT: undefined, CLOUD_TASKS_AUTH_TOKEN: 'internal-token' }, 'api');
assert.deepEqual(result.invalid, []);

result = inspectTargetEnvironment({ ...valid, ENABLE_GOOGLE_CALENDAR: 'true', GOOGLE_CALENDAR_CLIENT_ID: 'id', GOOGLE_CALENDAR_CLIENT_SECRET: undefined, GOOGLE_CALENDAR_REDIRECT_URI: 'https://example.test/callback' }, 'api');
assert.ok(result.missing.includes('GOOGLE_CALENDAR_CLIENT_SECRET'));

console.log('target configuration tests passed');
