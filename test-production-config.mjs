import assert from 'node:assert/strict';
import { inspectProductionEnvironment } from './server-config.mjs';

const valid = {
  NODE_ENV: 'production',
  APP_URL: 'https://raloa.app',
  AUTH_SESSION_SECRET: 'a'.repeat(48),
  INTEGRATION_ENCRYPTION_KEY: 'b'.repeat(48),
  FIREBASE_PROJECT_ID: 'raloa-production',
  FIRESTORE_DATABASE_ID: 'raloa',
  FIREBASE_STORAGE_BUCKET: 'raloa.firebasestorage.app',
  FIREBASE_ADMIN_ENABLED: 'true',
  K_SERVICE: 'raloa',
  STRIPE_SECRET_KEY: 'sk_live_production',
  STRIPE_WEBHOOK_SECRET: 'whsec_production',
  STRIPE_PRICE_PRO_MONTHLY: 'price_pro_monthly',
  STRIPE_PRICE_PRO_YEARLY: 'price_pro_yearly',
  STRIPE_PRICE_STUDIO_MONTHLY: 'price_studio_monthly',
  STRIPE_PRICE_STUDIO_YEARLY: 'price_studio_yearly',
  CLOUDFLARE_API_TOKEN: 'a'.repeat(40),
  CLOUDFLARE_ZONE_ID: 'a'.repeat(32),
  TRUSTED_PROXY_HOPS: '1'
};

const validResult = inspectProductionEnvironment(valid);
assert.deepEqual(validResult.missing, []);
assert.deepEqual(validResult.invalid, []);

const missingResult = inspectProductionEnvironment({ NODE_ENV: 'production' });
assert.ok(missingResult.missing.includes('APP_URL'));
assert.ok(missingResult.missing.includes('STRIPE_SECRET_KEY'));
assert.ok(missingResult.invalid.some((message) => message.includes('Firebase Admin credentials')));

const unsafeResult = inspectProductionEnvironment({
  ...valid,
  STRIPE_SECRET_KEY: 'sk_test_not_allowed',
  FIREBASE_ADMIN_ENABLED: 'false',
  APP_URL: 'http://localhost:3000',
  TRUSTED_PROXY_HOPS: '11'
});
assert.ok(unsafeResult.invalid.some((message) => message.includes('live Stripe')));
assert.ok(unsafeResult.invalid.some((message) => message.includes('FIREBASE_ADMIN_ENABLED')));
assert.ok(unsafeResult.invalid.some((message) => message.includes('https://')));
assert.ok(unsafeResult.invalid.some((message) => message.includes('TRUSTED_PROXY_HOPS')));

const optionalResult = inspectProductionEnvironment({
  ...valid,
  GOOGLE_CALENDAR_CLIENT_ID: 'google-client'
});
assert.ok(optionalResult.invalid.some((message) => message.includes('Google Calendar configuration is incomplete')));

console.log('PASS: production configuration validation covers required, invalid, and optional settings');
