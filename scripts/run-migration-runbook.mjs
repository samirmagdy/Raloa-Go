#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { inspectMigrationEnvironment } from '../server-config.mjs';
import { validateControlledApproval } from './cutover-approval.mjs';

const args = new Set(process.argv.slice(2));
const stageArg = process.argv.slice(2).find((value) => value.startsWith('--stage='));
const stage = stageArg ? Number(stageArg.slice('--stage='.length)) : 0;
const execute = args.has('--execute');
const json = args.has('--json');

const stages = {
  0: { name: 'preconditions', irreversible: false, commands: ['npm run validate:migration', 'npm run check:migrations', 'npm run test:integration:staging'] },
  1: { name: 'source snapshot', irreversible: false, commands: ['npm run verify:firestore-archive'] },
  2: { name: 'initial migration', irreversible: false, commands: ['npm run migrate:firestore-postgres -- --dry-run', 'MEDIA_MIGRATION_DRY_RUN=true npm run migrate:media'] },
  3: { name: 'reconciliation', irreversible: false, commands: ['npm run reconcile:firestore-postgres', 'npm run reconcile:media-r2'] },
  4: { name: 'application equivalence', irreversible: false, commands: ['npm run test:legacy', 'npm run test:booking-concurrency', 'npm run test:commerce-concurrency', 'npm run test:integration:staging'] },
  5: { name: 'authority cutover', irreversible: true, commands: ['controlled deployment: enable PostgreSQL/R2 authority and disable legacy fallback'] },
  6: { name: 'observation window', irreversible: false, commands: ['monitor dashboards and run repeated reconciliation; do not delete legacy systems'] },
  7: { name: 'decommission approval', irreversible: true, commands: ['obtain signed human approval artifact'] },
  8: { name: 'decommission', irreversible: true, commands: ['npm run check:firestore-decommission', 'npm run check:media-r2-decommission', 'controlled deployment: remove legacy runtime and configuration'] }
};

function fail(message) {
  const output = { status: 'blocked', stage, message };
  if (json) console.log(JSON.stringify(output, null, 2)); else console.error(`[migration-runbook] BLOCKED: ${message}`);
  process.exit(1);
}

function verifyReconciliationArtifact() {
  const file = process.env.RECONCILIATION_ARTIFACT_FILE;
  const errors = [];
  if (!file) return ['RECONCILIATION_ARTIFACT_FILE is required'];
  let contents;
  try { contents = fs.readFileSync(file); } catch { return [`reconciliation artifact is unreadable: ${file}`]; }
  let artifact;
  try { artifact = JSON.parse(contents.toString('utf8')); } catch { return ['reconciliation artifact is not valid JSON']; }
  const hash = crypto.createHash('sha256').update(contents).digest('hex');
  if (artifact.status !== 'passed') errors.push('reconciliation artifact status must be passed');
  if (Number(artifact.criticalMismatchCount ?? artifact.criticalMismatches ?? 0) !== 0) errors.push('reconciliation artifact contains critical mismatches');
  if (process.env.RECONCILIATION_ARTIFACT_SHA256 && process.env.RECONCILIATION_ARTIFACT_SHA256 !== hash) errors.push('RECONCILIATION_ARTIFACT_SHA256 does not match the artifact');
  if (process.env.AUTHORITY_CUTOVER_APPROVAL_FILE || process.env.DECOMMISSION_APPROVAL_FILE) {
    const approvalFiles = [process.env.AUTHORITY_CUTOVER_APPROVAL_FILE, process.env.DECOMMISSION_APPROVAL_FILE].filter(Boolean);
    for (const approvalFile of approvalFiles) {
      try {
        const approval = JSON.parse(fs.readFileSync(approvalFile, 'utf8'));
        if (approval.reconciliationReportSha256 !== hash) errors.push(`approval ${approvalFile} does not bind to the reconciliation artifact hash`);
      } catch { errors.push(`approval ${approvalFile} is unreadable`); }
    }
  }
  return errors;
}

if (!Number.isInteger(stage) || !stages[stage]) fail('stage must be an integer from 0 through 8');
const selected = stages[stage];
const report = { status: 'plan', stage, name: selected.name, execute, irreversible: selected.irreversible, commands: selected.commands, intendedReads: [], intendedWrites: [], intendedDeletes: [] };

if (stage === 0) {
  const config = inspectMigrationEnvironment(process.env);
  const preconditionVariables = ['POSTGRES_DATABASE_URL', 'POSTGRES_ENABLED', 'POSTGRES_SSL', 'CLOUDFLARE_R2_ACCOUNT_ID', 'CLOUDFLARE_R2_BUCKET', 'CLOUDFLARE_R2_ENDPOINT', 'CLOUDFLARE_R2_ACCESS_KEY_ID', 'CLOUDFLARE_R2_SECRET_ACCESS_KEY', 'FIRESTORE_SOURCE_PROJECT_ID', 'FIREBASE_STORAGE_SOURCE_BUCKET', 'FIREBASE_ADMIN_ENABLED'];
  const missingPreconditions = preconditionVariables.filter((name) => !process.env[name]);
  if (config.missing.length || config.invalid.length || missingPreconditions.length) fail(`preconditions are incomplete: ${[...config.missing.map((name) => `missing ${name}`), ...config.invalid, ...missingPreconditions.map((name) => `missing ${name}`)].join('; ')}`);
  report.intendedReads.push('PostgreSQL, Firestore, Firebase Storage, R2, archive destination, staging health and migration metadata');
}

if (stage === 5) {
  const required = {
    FIRESTORE_RECONCILIATION_STATUS: 'passed', MEDIA_R2_RECONCILIATION_STATUS: 'passed',
    MIGRATION_COMPLETION_STATUS: 'passed', FIRESTORE_ARCHIVE_VERIFICATION_STATUS: 'passed',
    CRITICAL_MISMATCH_COUNT: '0', CUTOVER_APPROVAL_STATUS: 'approved', FIRESTORE_AUTHORITY_CUTOVER_APPROVED: 'true'
  };
  const mismatches = Object.entries(required).filter(([name, value]) => process.env[name] !== value).map(([name, value]) => `${name}=${value} required`);
  const approvalErrors = validateControlledApproval(process.env, { fileVariable: 'AUTHORITY_CUTOVER_APPROVAL_FILE', publicKeyVariable: 'AUTHORITY_CUTOVER_APPROVAL_PUBLIC_KEY', operation: 'authority-cutover' });
  if (!process.env.FIRESTORE_ARCHIVE_URI) mismatches.push('FIRESTORE_ARCHIVE_URI is required');
  mismatches.push(...verifyReconciliationArtifact());
  if (approvalErrors.length) mismatches.push(...approvalErrors);
  if (mismatches.length) fail(`authority cutover gate failed: ${mismatches.join('; ')}`);
  report.intendedWrites.push('controlled deployment configuration selecting PostgreSQL and R2');
  report.intendedDeletes.push('none; legacy systems remain during observation');
}

if (stage === 7) {
  const approvalErrors = validateControlledApproval(process.env, { fileVariable: 'DECOMMISSION_APPROVAL_FILE', publicKeyVariable: 'DECOMMISSION_APPROVAL_PUBLIC_KEY', operation: 'legacy-decommission' });
  const required = ['FIRESTORE_RECONCILIATION_STATUS', 'MEDIA_R2_RECONCILIATION_STATUS', 'MIGRATION_COMPLETION_STATUS', 'FIRESTORE_ARCHIVE_VERIFICATION_STATUS', 'OBSERVATION_WINDOW_STATUS'];
  const missing = required.filter((name) => process.env[name] !== 'passed');
  if (process.env.FIRESTORE_DECOMMISSION_APPROVED !== 'true') missing.push('FIRESTORE_DECOMMISSION_APPROVED=true required');
  const reconciliationErrors = verifyReconciliationArtifact();
  if (!process.env.FIRESTORE_ARCHIVE_URI) missing.push('FIRESTORE_ARCHIVE_URI is required');
  if (missing.length || approvalErrors.length || reconciliationErrors.length) fail(`decommission approval gate failed: ${[...missing.map((name) => `${name}=passed required`), ...approvalErrors, ...reconciliationErrors].join('; ')}`);
}

if (stage === 8) {
  if (!execute) report.status = 'plan-only';
  const required = ['FIRESTORE_RECONCILIATION_STATUS', 'MEDIA_R2_RECONCILIATION_STATUS', 'MIGRATION_COMPLETION_STATUS', 'FIRESTORE_ARCHIVE_VERIFICATION_STATUS', 'OBSERVATION_WINDOW_STATUS'];
  const missing = required.filter((name) => process.env[name] !== 'passed');
  const approvalErrors = validateControlledApproval(process.env, { fileVariable: 'DECOMMISSION_APPROVAL_FILE', publicKeyVariable: 'DECOMMISSION_APPROVAL_PUBLIC_KEY', operation: 'legacy-decommission' });
  if (process.env.FIRESTORE_DECOMMISSION_APPROVED !== 'true') missing.push('FIRESTORE_DECOMMISSION_APPROVED=true required');
  const reconciliationErrors = verifyReconciliationArtifact();
  if (missing.length || approvalErrors.length || reconciliationErrors.length) fail(`decommission gate failed: ${[...missing.map((name) => `${name}=passed required`), ...approvalErrors, ...reconciliationErrors].join('; ')}`);
  report.intendedDeletes.push('legacy Firestore/Storage runtime code and configuration only after reviewed release certification');
}

if (execute && !selected.irreversible) {
  for (const command of selected.commands) {
    if (command.includes('controlled deployment') || command.includes('monitor dashboards')) continue;
    const [executable, ...commandArgs] = command.split(' ');
    const result = spawnSync(executable, commandArgs, { stdio: 'inherit', shell: true, env: process.env });
    if (result.status !== 0) fail(`command failed: ${command}`);
  }
  report.status = 'executed';
}

if (json) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`[migration-runbook] ${report.status}: Stage ${stage} — ${selected.name}`);
  for (const command of selected.commands) console.log(`  ${command}`);
  if (!execute) console.log('  plan-only; no command was executed');
}
