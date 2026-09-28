import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const requestedSuite = process.argv[2] || 'all';
const manifest = JSON.parse(fs.readFileSync('tests/legacy-manifest.json', 'utf8'));
const selected = manifest.filter((entry) => requestedSuite === 'all' || entry.suite === requestedSuite);
const timeoutMs = Number(process.env.TEST_TIMEOUT_MS || 60_000);
const results = [];

fs.mkdirSync('reports', { recursive: true });

for (const entry of selected) {
  const command = entry.file.endsWith('.mjs') ? process.execPath : 'npx';
  const args = entry.file.endsWith('.mjs') ? [entry.file] : ['tsx', entry.file];
  const startedAt = Date.now();
  const result = await new Promise((resolve) => {
    const childEnv = { ...process.env, NODE_ENV: 'test', ...(entry.env || {}) };
    // Legacy tests are fixture-backed and must never inherit a CI deployment's
    // Google/Firebase credentials. Several provider SDKs begin ADC discovery
    // during construction, before application-level guards can run.
    for (const key of [
      'GOOGLE_APPLICATION_CREDENTIALS',
      'GOOGLE_CLOUD_PROJECT',
      'GCP_PROJECT',
      'GCLOUD_PROJECT',
      'K_SERVICE',
      'FIREBASE_ADMIN_ENABLED',
      'SECRET_MANAGER_ENABLED',
      'INTEGRATION_KMS_KEY_NAME',
      'CLOUD_TASKS_PROJECT_ID',
      'CLOUD_TASKS_LOCATION',
      'CLOUD_TASKS_QUEUE',
      'CLOUD_TASKS_WORKER_URL',
      'CLOUD_TASKS_SERVICE_ACCOUNT',
      'CLOUD_TASKS_DISPATCH_URL',
      'PUBSUB_DISPATCH_URL'
    ]) delete childEnv[key];
    childEnv.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
    childEnv.SECRET_MANAGER_ENABLED = 'false';
    const child = spawn(command, args, { env: childEnv, stdio: 'inherit' });
    const timer = setTimeout(() => { child.kill('SIGTERM'); resolve({ code: 124, timedOut: true }); }, timeoutMs);
    child.on('exit', (code, signal) => { clearTimeout(timer); resolve({ code: code ?? 1, signal, timedOut: false }); });
  });
  results.push({ ...entry, ...result, durationMs: Date.now() - startedAt });
}

const failures = results.filter((result) => result.code !== 0);
const testcases = results.map((result) => result.code === 0
  ? `<testcase classname="legacy.${result.suite}" name="${result.file}" time="${(result.durationMs / 1000).toFixed(3)}"/>`
  : `<testcase classname="legacy.${result.suite}" name="${result.file}" time="${(result.durationMs / 1000).toFixed(3)}"><failure message="exit ${result.code}"/></testcase>`).join('');
fs.writeFileSync('reports/legacy-tests.xml', `<?xml version="1.0"?><testsuite name="legacy-tests" tests="${results.length}" failures="${failures.length}">${testcases}</testsuite>\n`);
console.log(`Legacy test harness: ${results.length - failures.length}/${results.length} passed; report written to reports/legacy-tests.xml`);
if (failures.length) process.exit(1);
