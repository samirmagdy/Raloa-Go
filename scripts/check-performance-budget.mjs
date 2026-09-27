import fs from 'node:fs';
import path from 'node:path';

const assetsDir = path.resolve('dist/assets');
if (!fs.existsSync(assetsDir)) {
  console.error('Performance budget failed: dist/assets does not exist. Run the production build first.');
  process.exit(1);
}

const files = fs.readdirSync(assetsDir).filter((file) => file.endsWith('.js'));
const sizes = files.map((file) => ({ file, bytes: fs.statSync(path.join(assetsDir, file)).size }));
const rules = [
  { name: 'Studio chunk', match: /StudioModal-/i, max: 350 * 1024 },
  { name: 'Firebase vendor chunk', match: /vendor-firebase-/i, max: 650 * 1024 },
  { name: 'Application entry chunk', match: /^index-/i, max: 900 * 1024 }
];
let failed = false;
for (const rule of rules) {
  const file = sizes.find((item) => rule.match.test(item.file));
  if (!file) { console.error(`Performance budget failed: ${rule.name} was not emitted.`); failed = true; continue; }
  console.log(`${rule.name}: ${file.file} ${(file.bytes / 1024).toFixed(1)} KiB / ${(rule.max / 1024).toFixed(0)} KiB`);
  if (file.bytes > rule.max) { console.error(`Performance budget exceeded: ${rule.name}`); failed = true; }
}
if (failed) process.exit(1);
