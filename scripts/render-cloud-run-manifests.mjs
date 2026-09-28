import fs from 'node:fs/promises';
import path from 'node:path';

const environment = process.env.DEPLOY_ENVIRONMENT || 'production';
const required = [
  'DEPLOY_IMAGE',
  'DEPLOY_PROJECT_ID',
  'DEPLOY_REGION',
  'DEPLOY_RELEASE_ID',
  'DEPLOY_RUNTIME_SERVICE_ACCOUNT',
  'DEPLOY_WORKER_SERVICE_ACCOUNT',
  'DEPLOY_FIRESTORE_DATABASE_ID',
  'DEPLOY_STORAGE_BUCKET',
  'DEPLOY_KMS_KEY_RESOURCE',
  'DEPLOY_STRIPE_PRICE_PRO_MONTHLY',
  'DEPLOY_STRIPE_PRICE_PRO_YEARLY',
  'DEPLOY_STRIPE_PRICE_STUDIO_MONTHLY',
  'DEPLOY_STRIPE_PRICE_STUDIO_YEARLY',
  'DEPLOY_CLOUDFLARE_ZONE_ID',
  'DEPLOY_WORKER_TASKS_URL',
];

if (environment === 'staging') {
  required.push('DEPLOY_APP_URL', 'DEPLOY_RESOURCE_PREFIX', 'DEPLOY_CLOUDFLARE_R2_ACCOUNT_ID', 'DEPLOY_CLOUDFLARE_R2_BUCKET', 'DEPLOY_CLOUDFLARE_R2_PUBLIC_BASE_URL', 'DEPLOY_CLOUD_TASKS_PROJECT_ID', 'DEPLOY_CLOUD_TASKS_LOCATION', 'DEPLOY_CLOUD_TASKS_QUEUE', 'DEPLOY_SENTRY_DSN');
}

for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
}

const outputDir = process.env.DEPLOY_OUTPUT_DIR ?? '.generated-cloud-run';
const defaults = {
  appUrl: environment === 'staging' ? process.env.DEPLOY_APP_URL : 'https://raloa.app',
  resourcePrefix: process.env.DEPLOY_RESOURCE_PREFIX || 'raloa',
  publicWebService: environment === 'staging' ? `${process.env.DEPLOY_RESOURCE_PREFIX}-public-web` : 'raloa-public-web',
  studioApiService: environment === 'staging' ? `${process.env.DEPLOY_RESOURCE_PREFIX}-studio-api` : 'raloa-studio-api',
  backgroundWorkerService: environment === 'staging' ? `${process.env.DEPLOY_RESOURCE_PREFIX}-background-worker` : 'raloa-background-worker',
  r2Authority: environment === 'staging' ? 'true' : 'false',
  r2AccountId: process.env.DEPLOY_CLOUDFLARE_R2_ACCOUNT_ID || '',
  r2Bucket: process.env.DEPLOY_CLOUDFLARE_R2_BUCKET || '',
  r2PublicBaseUrl: process.env.DEPLOY_CLOUDFLARE_R2_PUBLIC_BASE_URL || '',
  tasksProject: process.env.DEPLOY_CLOUD_TASKS_PROJECT_ID || '',
  tasksLocation: process.env.DEPLOY_CLOUD_TASKS_LOCATION || '',
  tasksQueue: process.env.DEPLOY_CLOUD_TASKS_QUEUE || '',
  sentryDsn: process.env.DEPLOY_SENTRY_DSN || '',
};
const replacements = {
  'REGION-docker.pkg.dev/PROJECT_ID/raloa/raloa:RELEASE_ID': process.env.DEPLOY_IMAGE,
  RALOA_RUNTIME_SERVICE_ACCOUNT: process.env.DEPLOY_RUNTIME_SERVICE_ACCOUNT,
  RALOA_WORKER_SERVICE_ACCOUNT: process.env.DEPLOY_WORKER_SERVICE_ACCOUNT,
  __RELEASE_ID__: process.env.DEPLOY_RELEASE_ID,
  PROJECT_ID: process.env.DEPLOY_PROJECT_ID,
  FIRESTORE_DATABASE_ID: process.env.DEPLOY_FIRESTORE_DATABASE_ID,
  STORAGE_BUCKET: process.env.DEPLOY_STORAGE_BUCKET,
  KMS_KEY_RESOURCE: process.env.DEPLOY_KMS_KEY_RESOURCE,
  STRIPE_PRICE_PRO_MONTHLY: process.env.DEPLOY_STRIPE_PRICE_PRO_MONTHLY,
  STRIPE_PRICE_PRO_YEARLY: process.env.DEPLOY_STRIPE_PRICE_PRO_YEARLY,
  STRIPE_PRICE_STUDIO_MONTHLY: process.env.DEPLOY_STRIPE_PRICE_STUDIO_MONTHLY,
  STRIPE_PRICE_STUDIO_YEARLY: process.env.DEPLOY_STRIPE_PRICE_STUDIO_YEARLY,
  'https://raloa-worker-TBD.run.app/tasks/background-jobs': process.env.DEPLOY_WORKER_TASKS_URL,
  RALOA_PUBLIC_WEB_SERVICE: defaults.publicWebService,
  RALOA_STUDIO_API_SERVICE: defaults.studioApiService,
  RALOA_BACKGROUND_WORKER_SERVICE: defaults.backgroundWorkerService,
  __APP_URL__: defaults.appUrl,
  DEPLOY_ENVIRONMENT: environment,
  MEDIA_R2_AUTHORITY: defaults.r2Authority,
  __CLOUDFLARE_R2_ACCOUNT_ID__: defaults.r2AccountId,
  __CLOUDFLARE_R2_BUCKET__: defaults.r2Bucket,
  __CLOUDFLARE_R2_PUBLIC_BASE_URL__: defaults.r2PublicBaseUrl,
  __TASKS_PROJECT__: defaults.tasksProject,
  __TASKS_LOCATION__: defaults.tasksLocation,
  __TASKS_QUEUE__: defaults.tasksQueue,
  __TASKS_WORKER_URL__: process.env.DEPLOY_WORKER_TASKS_URL,
  __SENTRY_DSN__: defaults.sentryDsn,
  __CLOUDFLARE_ZONE_ID__: process.env.DEPLOY_CLOUDFLARE_ZONE_ID,
};

await fs.mkdir(outputDir, { recursive: true });
for (const file of ['public-web.yaml', 'studio-api.yaml', 'background-worker.yaml']) {
  let source = await fs.readFile(path.join('deploy/cloud-run', file), 'utf8');
  for (const [token, value] of Object.entries(replacements)) source = source.split(token).join(value);
  await fs.writeFile(path.join(outputDir, file), source);
}

console.log(`Rendered Cloud Run manifests to ${outputDir}`);
