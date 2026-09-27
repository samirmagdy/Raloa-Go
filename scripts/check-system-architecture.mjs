import fs from 'node:fs';

const requiredFiles = [
  'deploy/cloud-run/public-web.yaml',
  'deploy/cloud-run/studio-api.yaml',
  'deploy/cloud-run/background-worker.yaml',
  'server/modules.ts',
  'server/outbox/index.ts',
  'server/events/index.ts',
  'server/background-jobs/index.ts',
  'server/infrastructure/postgres/schema.ts',
  'server/infrastructure/analytics/pipeline.ts',
  'server/domains/media/index.ts',
  'server/adapters/cloudflare.ts',
  'server/adapters/stripe.ts',
  'docs/next-migration-boundary.md'
];
const missing = requiredFiles.filter((file) => !fs.existsSync(file));
if (missing.length) {
  console.error(`System architecture is missing required boundaries:\n${missing.join('\n')}`);
  process.exit(1);
}

const publicManifest = fs.readFileSync('deploy/cloud-run/public-web.yaml', 'utf8');
const workerManifest = fs.readFileSync('deploy/cloud-run/background-worker.yaml', 'utf8');
const failures = [];
if (!publicManifest.includes('value: public-web')) failures.push('public web manifest does not declare SERVICE_ROLE=public-web');
if (!workerManifest.includes('value: background-worker')) failures.push('worker manifest does not declare SERVICE_ROLE=background-worker');
if (!fs.readFileSync('docs/system-architecture.md', 'utf8').includes('Planned incremental boundary; not yet deployed')) failures.push('Next.js transitional status must be explicit');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('system architecture conformance passed (Next.js public renderer remains transitional)');
