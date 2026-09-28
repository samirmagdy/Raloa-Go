import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/ci-cd.yml', 'utf8');
const required = [
  'npm run lint',
  'npm run check:api',
  'npm run test:unit',
  'npm run test:domain',
  'npm run test:staging-config',
  'npm --prefix apps/web run build',
  'npm run check:performance:next',
  'npm run test:http',
  'npm run test:contracts',
  'npm run test:feature-flags',
  'npm run test:strangler-migration',
  'npm run check:secrets',
  'npm run check:modular-monolith',
  'npm run check:adrs',
  'npm run check:capacity-plan',
  'npm run check:cost-architecture',
  'npm run check:system-architecture',
  'npm run validate:production',
  'npm run db:migrate',
  'npm run db:migrate:verify',
  'npm run test:integration:staging',
  'npm run test:integration:staging:creator-flow',
  'npm run validate:staging',
  'npm run smoke:release',
  'gcloud run services replace',
  'migrate-production:',
  'production-smoke:',
];

const missing = required.filter((entry) => !workflow.includes(entry));
if (missing.length) {
  console.error(`CI/CD workflow is missing required gates: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('CI/CD workflow contains the required staged gates.');
