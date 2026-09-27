import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const controllerRoot = path.join(root, 'server', 'http', 'controllers');
const forbidden = [
  /firebase-admin\/firestore/,
  /\bFirestore\b/,
  /\badminDb\b/,
  /\.collection(Group)?\s*\(/,
  /\.runTransaction\s*\(/,
  /\.batch\s*\(/,
  /\.getAll\s*\(/,
];
const violations = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    if (!entry.isFile() || !/\.ts$/.test(entry.name)) continue;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (forbidden.some((pattern) => pattern.test(line))) violations.push(`${path.relative(root, file)}:${index + 1}`);
    });
  }
}

if (fs.existsSync(controllerRoot)) walk(controllerRoot);
if (violations.length) {
  console.error('Route persistence boundary failed. Controllers must use repositories or domain services:\n' + violations.join('\n'));
  process.exit(1);
}
console.log('Route persistence boundary passed');

