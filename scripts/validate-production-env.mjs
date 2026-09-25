const required = [
  'APP_URL',
  'AUTH_SESSION_SECRET',
  'FIREBASE_PROJECT_ID',
  'FIRESTORE_DATABASE_ID',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_PRO_MONTHLY',
  'STRIPE_PRICE_PRO_YEARLY',
  'STRIPE_PRICE_STUDIO_MONTHLY',
  'STRIPE_PRICE_STUDIO_YEARLY',
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ZONE_ID',
  'TRUSTED_PROXY_HOPS'
];

const missing = required.filter((name) => !process.env[name]);
const invalid = [];
if (process.env.APP_URL && !/^https:\/\//.test(process.env.APP_URL)) invalid.push('APP_URL must use https://');
if (process.env.AUTH_SESSION_SECRET && process.env.AUTH_SESSION_SECRET.length < 32) invalid.push('AUTH_SESSION_SECRET must be at least 32 characters');
if (process.env.TRUSTED_PROXY_HOPS && (!/^\d+$/.test(process.env.TRUSTED_PROXY_HOPS) || Number(process.env.TRUSTED_PROXY_HOPS) > 10)) invalid.push('TRUSTED_PROXY_HOPS must be an integer from 0 to 10');

if (missing.length || invalid.length) {
  console.error('Production configuration is incomplete.');
  if (missing.length) console.error(`Missing: ${missing.join(', ')}`);
  invalid.forEach((message) => console.error(`Invalid: ${message}`));
  process.exit(1);
}

console.log('Production configuration variables are present.');
