import fs from 'node:fs';
import path from 'node:path';

const roots = ['server.ts', 'server-services.ts', 'server', 'worker.ts', 'apps/web/src', 'src'];
const ignored = new Set(['node_modules', 'dist', 'test-results', 'reports']);
const patterns = [
  /firebase-admin\/firestore/g,
  /firebase\/firestore/g,
  /getFirestore\s*\(/g,
  /adminDb\.(collection|collectionGroup|runTransaction|batch)\s*\(/g,
  /createFirestore[A-Za-z]+/g
];
const files = [];
function walk(target) {
  if (!fs.existsSync(target)) return;
  const stat = fs.statSync(target);
  if (stat.isFile()) { files.push(target); return; }
  for (const entry of fs.readdirSync(target)) if (!ignored.has(entry)) walk(path.join(target, entry));
}
for (const root of roots) walk(root);

const hits = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  if (patterns.some((pattern) => { pattern.lastIndex = 0; return pattern.test(source); })) hits.push(file);
}

const blockers = [];
if (hits.length) blockers.push(`Firestore application references remain in ${new Set(hits).size} runtime files.`);
if (process.env.FIRESTORE_RECONCILIATION_STATUS !== 'passed') blockers.push('FIRESTORE_RECONCILIATION_STATUS=passed is required.');
if (process.env.FIRESTORE_AUTHORITY_CUTOVER_APPROVED !== 'true') blockers.push('FIRESTORE_AUTHORITY_CUTOVER_APPROVED=true is required.');
if (process.env.POSTGRES_ENABLED !== 'true') blockers.push('POSTGRES_ENABLED=true is required for the PostgreSQL-only runtime.');

if (blockers.length) {
  console.error('PostgreSQL authority gate blocked:');
  for (const blocker of blockers) console.error(`- ${blocker}`);
  if (hits.length) console.error(`Files: ${[...new Set(hits)].sort().join(', ')}`);
  console.error('Firebase Auth is retained and is not a blocker.');
  process.exit(1);
}
console.log('PostgreSQL authority gate passed; Firebase Auth references are retained.');

