import fs from 'node:fs/promises';
import path from 'node:path';

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

for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
}

const outputDir = process.env.DEPLOY_OUTPUT_DIR ?? '.generated-cloud-run';
const replacements = {
  'REGION-docker.pkg.dev/PROJECT_ID/raloa/raloa:RELEASE_ID': process.env.DEPLOY_IMAGE,
  RALOA_RUNTIME_SERVICE_ACCOUNT: process.env.DEPLOY_RUNTIME_SERVICE_ACCOUNT,
  RALOA_WORKER_SERVICE_ACCOUNT: process.env.DEPLOY_WORKER_SERVICE_ACCOUNT,
  RELEASE_ID: process.env.DEPLOY_RELEASE_ID,
  PROJECT_ID: process.env.DEPLOY_PROJECT_ID,
  FIRESTORE_DATABASE_ID: process.env.DEPLOY_FIRESTORE_DATABASE_ID,
  STORAGE_BUCKET: process.env.DEPLOY_STORAGE_BUCKET,
  KMS_KEY_RESOURCE: process.env.DEPLOY_KMS_KEY_RESOURCE,
  STRIPE_PRICE_PRO_MONTHLY: process.env.DEPLOY_STRIPE_PRICE_PRO_MONTHLY,
  STRIPE_PRICE_PRO_YEARLY: process.env.DEPLOY_STRIPE_PRICE_PRO_YEARLY,
  STRIPE_PRICE_STUDIO_MONTHLY: process.env.DEPLOY_STRIPE_PRICE_STUDIO_MONTHLY,
  STRIPE_PRICE_STUDIO_YEARLY: process.env.DEPLOY_STRIPE_PRICE_STUDIO_YEARLY,
  CLOUDFLARE_ZONE_ID: process.env.DEPLOY_CLOUDFLARE_ZONE_ID,
  'https://raloa-worker-TBD.run.app/tasks/background-jobs': process.env.DEPLOY_WORKER_TASKS_URL,
};

await fs.mkdir(outputDir, { recursive: true });
for (const file of ['public-web.yaml', 'studio-api.yaml', 'background-worker.yaml']) {
  let source = await fs.readFile(path.join('deploy/cloud-run', file), 'utf8');
  for (const [token, value] of Object.entries(replacements)) source = source.split(token).join(value);
  await fs.writeFile(path.join(outputDir, file), source);
}

console.log(`Rendered Cloud Run manifests to ${outputDir}`);
