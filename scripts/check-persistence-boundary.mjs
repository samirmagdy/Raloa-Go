import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const allowed = `${path.sep}server${path.sep}infrastructure${path.sep}postgres${path.sep}`;
const migrationTools = [
  `${path.sep}scripts${path.sep}run-postgres-migrations.mjs`,
  `${path.sep}scripts${path.sep}verify-postgres-migrations.mjs`
];
const violations = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory() && !['node_modules', 'dist', '.git'].includes(entry.name)) walk(file);
    if (!entry.isFile() || !/\.(ts|tsx|js|mjs)$/.test(entry.name)) continue;
    const source = fs.readFileSync(file, 'utf8');
    if (!source.match(/from ['"](?:drizzle-orm|pg)(?:\/|['"])/)) continue;
    if (!file.includes(allowed) && !migrationTools.some((tool) => file.endsWith(tool))) violations.push(path.relative(root, file));
  }
}

walk(root);
if (violations.length) {
  console.error(`PostgreSQL ORM imports must stay under server/infrastructure/postgres:\n${violations.join('\n')}`);
  process.exit(1);
}
console.log('PostgreSQL persistence boundary passed');
