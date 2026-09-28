import fs from 'node:fs';
import path from 'node:path';

const roots = ['server.ts', 'server-services.ts', 'server', 'apps/web/src', 'src'];
const ignored = new Set(['node_modules', 'dist', 'test-results', 'reports']);
const patterns = [
  /firebase-admin\/storage/g,
  /firebase\/storage/g,
  /getStorage\s*\(/g,
  /adminStorage\s*\./g,
  /FIREBASE_STORAGE_BUCKET/g,
  /createFirebaseStorageAdapter/g,
  /firebase_storage/g
];
const files = [];

function walk(target) {
  if (!fs.existsSync(target)) return;
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    files.push(target);
    return;
  }
  for (const entry of fs.readdirSync(target)) {
    if (!ignored.has(entry)) walk(path.join(target, entry));
  }
}

for (const root of roots) walk(root);

const hits = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(source)) {
      hits.push(file);
      break;
    }
  }
}

const evidence = [
  ['MEDIA_R2_COUNTS_VERIFIED', 'object counts and variants are reconciled'],
  ['MEDIA_R2_URLS_VERIFIED', 'authoritative URLs resolve to R2/CDN'],
  ['MEDIA_R2_OWNERSHIP_VERIFIED', 'ownership and tenant isolation are verified'],
  ['MEDIA_R2_PUBLIC_RENDERING_VERIFIED', 'published pages render R2 assets'],
  ['MEDIA_R2_DELETION_VERIFIED', 'authorized and unauthorized deletion behavior is verified'],
  ['MEDIA_R2_UPLOAD_VERIFIED', 'upload validation, quotas, and processing are verified']
];

const blockers = [];
if (hits.length) blockers.push(`Firebase Storage source references remain in ${new Set(hits).size} files.`);
if (process.env.MEDIA_R2_RECONCILIATION_STATUS !== 'passed') blockers.push('MEDIA_R2_RECONCILIATION_STATUS=passed is required.');
if (!process.env.MEDIA_R2_ARCHIVE_URI) blockers.push('MEDIA_R2_ARCHIVE_URI is required before metadata cleanup.');
for (const [name, description] of evidence) {
  if (process.env[name] !== 'true') blockers.push(`${name}=true is required: ${description}.`);
}
if (process.env.MEDIA_R2_DECOMMISSION_APPROVED !== 'true') {
  blockers.push('MEDIA_R2_DECOMMISSION_APPROVED=true is required for destructive cleanup.');
}

if (blockers.length) {
  console.error('Media R2 decommission gate blocked:');
  for (const blocker of blockers) console.error(`- ${blocker}`);
  if (hits.length) console.error(`Files: ${[...new Set(hits)].sort().join(', ')}`);
  console.error('Firebase Auth references are intentionally excluded from this gate.');
  process.exit(1);
}

console.log('Media R2 decommission gate passed; Firebase Auth references are not considered blockers.');

