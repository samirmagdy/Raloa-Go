import fs from 'node:fs';
import path from 'node:path';

const roots = ['server.ts', 'server-services.ts', 'server', 'apps/web/src', 'src'];
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
  for (const entry of fs.readdirSync(target)) {
    if (!ignored.has(entry)) walk(path.join(target, entry));
  }
}
for (const root of roots) walk(root);

const hits = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) hits.push(file);
  }
}

const blockers = [];
if (hits.length) blockers.push(`Firestore production/source references remain in ${new Set(hits).size} files.`);
if (process.env.FIRESTORE_DECOMMISSION_APPROVED !== 'true') blockers.push('FIRESTORE_DECOMMISSION_APPROVED=true is required for the destructive cleanup phase.');
if (process.env.FIRESTORE_RECONCILIATION_STATUS !== 'passed') blockers.push('FIRESTORE_RECONCILIATION_STATUS=passed is required.');
if (!process.env.FIRESTORE_ARCHIVE_URI) blockers.push('FIRESTORE_ARCHIVE_URI is required before deletion.');

if (blockers.length) {
  console.error('Firestore decommission gate blocked:');
  for (const blocker of blockers) console.error(`- ${blocker}`);
  if (hits.length) console.error(`Files: ${[...new Set(hits)].sort().join(', ')}`);
  process.exit(1);
}
console.log('Firestore decommission gate passed; Firebase Auth references are not considered blockers.');
