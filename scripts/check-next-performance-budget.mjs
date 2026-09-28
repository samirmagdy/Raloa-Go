import fs from 'node:fs';
import path from 'node:path';

const chunksDir = path.resolve('apps/web/.next/static/chunks');
if (!fs.existsSync(chunksDir)) {
  console.error('Next performance budget failed: run npm --prefix apps/web run build first.');
  process.exit(1);
}

const files = fs.readdirSync(chunksDir)
  .filter((file) => file.endsWith('.js'))
  .map((file) => ({ file, bytes: fs.statSync(path.join(chunksDir, file)).size }))
  .sort((a, b) => b.bytes - a.bytes);
const totalBytes = files.reduce((sum, item) => sum + item.bytes, 0);
const budgets = [
  { label: 'largest Next.js JS chunk', actual: files[0]?.bytes || 0, max: 800 * 1024 },
  { label: 'total Next.js JS chunks', actual: totalBytes, max: 3 * 1024 * 1024 },
];
let failed = false;
for (const budget of budgets) {
  console.log(`${budget.label}: ${(budget.actual / 1024).toFixed(1)} KiB / ${(budget.max / 1024).toFixed(0)} KiB`);
  if (budget.actual > budget.max) {
    console.error(`Performance budget exceeded: ${budget.label}`);
    failed = true;
  }
}
if (failed) process.exit(1);
