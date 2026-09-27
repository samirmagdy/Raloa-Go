import fs from 'node:fs';
import path from 'node:path';

const roots = ['apps', 'packages'];
const forbiddenByLayer = [
  { layer: 'domain', patterns: ['/express', 'next/', 'react', 'firebase', 'stripe', 'cloudflare', 'firestore', 'pg'] },
  { layer: 'schemas', patterns: ['firebase', 'stripe', 'express', 'next/', 'react', 'pg'] },
  { layer: 'ui', patterns: ['firebase', 'firebase-admin', 'stripe', 'cloudflare', 'firestore', 'pg'] },
  { layer: 'api', patterns: ['firebase-admin', 'firestore', 'stripe', 'cloudflare', 'pg'] },
];

function filesIn(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesIn(file);
    return /\.(ts|tsx|js|jsx|mjs)$/.test(entry.name) ? [file] : [];
  });
}

const violations = [];
for (const root of roots) {
  for (const file of filesIn(root)) {
    const relative = file.split(path.sep).join('/');
    const layer = relative.split('/')[1];
    const rule = forbiddenByLayer.find((candidate) => candidate.layer === layer);
    if (!rule) continue;
    const source = fs.readFileSync(file, 'utf8');
    for (const pattern of rule.patterns) {
      if (new RegExp(`(?:from|import|require)\\s*[('\"]?[^'\"\\n]*${pattern.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}`, 'i').test(source)) {
        violations.push(`${relative}: forbidden ${pattern} import in ${layer}`);
      }
    }
  }
}

if (violations.length) {
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log(`architecture boundary check passed (${roots.join(', ')})`);

