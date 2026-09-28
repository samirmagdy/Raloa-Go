import fs from 'node:fs';

const dryRun = process.argv.includes('--dry-run') || process.env.MIGRATION_DRY_RUN === 'true';
const steps = [
  { name: 'sites', command: 'npm run migrate:sites' },
  { name: 'audience', command: 'npm run migrate:audience' },
  { name: 'booking schedules', command: 'npm run migrate:booking-schedules' },
  { name: 'bookings', command: 'npm run migrate:bookings -- backfill' },
  { name: 'commerce', command: 'npm run migrate:commerce' },
  { name: 'media metadata and objects', command: 'npm run migrate:media' }
];
const report = {
  mode: dryRun ? 'dry-run' : 'execution-plan-only',
  generatedAt: new Date().toISOString(),
  intendedReads: ['Firestore source collections and migration checkpoints'],
  intendedWrites: ['PostgreSQL domain tables', 'R2 objects and PostgreSQL media metadata'],
  intendedDeletes: [],
  steps,
  blockers: []
};

if (!dryRun) {
  report.blockers.push('This orchestrator does not execute destructive or authority-changing steps automatically. Run each reviewed domain migration command after credentials and approvals are present.');
  for (const name of ['POSTGRES_DATABASE_URL', 'DATABASE_URL', 'FIRESTORE_DATABASE_ID', 'FIREBASE_PROJECT_ID']) if (!process.env[name]) report.blockers.push(`${name} is required for live migration.`);
}
if (process.env.MIGRATION_PLAN_OUTPUT) fs.writeFileSync(process.env.MIGRATION_PLAN_OUTPUT, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!dryRun && report.blockers.length) process.exitCode = 1;

