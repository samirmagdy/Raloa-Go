import fs from 'node:fs';
import crypto from 'node:crypto';

const dryRun = process.argv.includes('--dry-run') || process.env.MEDIA_R2_RECONCILIATION_DRY_RUN === 'true';
const sourcePath = process.env.MEDIA_SOURCE_MANIFEST;
const targetPath = process.env.MEDIA_TARGET_MANIFEST;
if (!sourcePath || !targetPath) {
  console.error('MEDIA_SOURCE_MANIFEST and MEDIA_TARGET_MANIFEST are required. Use --dry-run with local fixture manifests.');
  process.exit(2);
}
function readManifest(file) {
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(value.objects)) throw new Error(`INVALID_MEDIA_MANIFEST:${file}`);
  return value.objects;
}
const source = readManifest(sourcePath);
const target = readManifest(targetPath);
const targetById = new Map(target.map((object) => [String(object.id), object]));
const differences = [];
for (const object of source) {
  const match = targetById.get(String(object.id));
  if (!match) { differences.push({ id: object.id, kind: 'missing_target' }); continue; }
  for (const field of ['ownerUserId', 'siteId', 'checksum', 'contentType', 'bytes']) if (String(object[field] ?? '') !== String(match[field] ?? '')) differences.push({ id: object.id, kind: field === 'ownerUserId' || field === 'siteId' ? 'ownership_mismatch' : 'semantic_mismatch', field });
  if (!String(match.cdnUrl || '').startsWith('http')) differences.push({ id: object.id, kind: 'invalid_url' });
}
for (const object of target) if (!source.some((candidate) => String(candidate.id) === String(object.id))) differences.push({ id: object.id, kind: 'unexpected_target' });
const report = { generatedAt: new Date().toISOString(), mode: dryRun ? 'dry-run' : 'fixture-reconciliation', sourceCount: source.length, targetCount: target.length, sourceManifestSha256: crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex'), targetManifestSha256: crypto.createHash('sha256').update(fs.readFileSync(targetPath)).digest('hex'), differences, status: differences.length ? 'blocked' : 'passed', intendedReads: [sourcePath, targetPath], intendedWrites: [], intendedDeletes: [] };
console.log(JSON.stringify(report, null, 2));
if (differences.length) process.exitCode = 1;

