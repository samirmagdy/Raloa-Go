import fs from 'node:fs';
import path from 'node:path';

const directory = path.resolve('docs/adr');
const files = fs.readdirSync(directory).filter((file) => /^\d{4}-.*\.md$/.test(file));
const requiredSections = ['## Context', '## Decision', '## Alternatives', '## Tradeoffs', '## Migration impact', '## Reversal strategy'];
const failures = [];
for (const file of files) {
  const source = fs.readFileSync(path.join(directory, file), 'utf8');
  for (const section of requiredSections) if (!source.includes(section)) failures.push(`${file}: missing ${section}`);
}
if (files.length < 9) failures.push(`expected at least 9 decision records, found ${files.length}`);
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`ADR check passed (${files.length} records)`);
