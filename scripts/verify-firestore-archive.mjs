import crypto from 'node:crypto';
import fs from 'node:fs';

function isImmutableArchiveUri(value) {
  try {
    const uri = new URL(value);
    return ['gs:', 's3:', 'r2:', 'https:'].includes(uri.protocol) && uri.pathname.length > 1;
  } catch {
    return false;
  }
}

const archiveUri = process.env.FIRESTORE_ARCHIVE_URI;
const manifestPath = process.env.FIRESTORE_ARCHIVE_MANIFEST;
if (!archiveUri) { console.error('FIRESTORE_ARCHIVE_URI is required.'); process.exit(2); }
if (!isImmutableArchiveUri(archiveUri)) { console.error('FIRESTORE_ARCHIVE_URI is not a valid immutable archive URI.'); process.exit(2); }
if (!manifestPath) { console.error('FIRESTORE_ARCHIVE_MANIFEST is required for local archive verification.'); process.exit(2); }
let manifest;
try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch { console.error('FIRESTORE_ARCHIVE_MANIFEST is unreadable JSON.'); process.exit(2); }
const required = ['exportedAt', 'sourceProject', 'collections', 'documentCount', 'sha256'];
const missing = required.filter((field) => manifest[field] === undefined || manifest[field] === null);
const canonicalManifest = { ...manifest, sha256: '' };
const actualHash = crypto.createHash('sha256').update(JSON.stringify(canonicalManifest)).digest('hex');
const report = { archiveUri, manifestPath, documentCount: manifest.documentCount, collectionCount: Array.isArray(manifest.collections) ? manifest.collections.length : 0, manifestSha256: actualHash, declaredSha256: manifest.sha256, status: missing.length === 0 && actualHash === manifest.sha256 ? 'passed' : 'blocked', missing };
console.log(JSON.stringify(report, null, 2));
if (report.status !== 'passed') process.exitCode = 1;
