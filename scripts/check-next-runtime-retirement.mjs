import fs from 'node:fs';
import path from 'node:path';

const roots = ['server.ts', 'server', 'src', 'apps/web/src', 'worker.ts', 'apps/workers/src'];
const ignored = new Set(['node_modules', 'dist', 'test-results', 'reports']);
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

const matches = (pattern) => files.filter((file) => pattern.test(fs.readFileSync(file, 'utf8')));
const expressFiles = matches(/from ['"]express['"]|express\.(json|urlencoded|static|raw)|app\.(get|post|put|patch|delete|use)\s*\(/);
const viteFiles = matches(/from ['"]vite['"]|import\.meta\.env|from ['"]react['"]|vite\.config|<script[^>]+type=["']module/);
const nextRouteFiles = files.filter((file) => /apps\/web\/src\/app\/.*(?:page|route)\.(tsx?|jsx?)$/.test(file));

const blockers = [];
if (process.env.NEXT_API_INVENTORY_STATUS !== 'passed') blockers.push('NEXT_API_INVENTORY_STATUS=passed is required.');
if (process.env.NEXT_FUNCTIONAL_EQUIVALENCE_STATUS !== 'passed') blockers.push('NEXT_FUNCTIONAL_EQUIVALENCE_STATUS=passed is required.');
if (process.env.NEXT_VITE_MIGRATION_STATUS !== 'passed') blockers.push('NEXT_VITE_MIGRATION_STATUS=passed is required.');
if (process.env.NEXT_PARITY_OBSERVATION_STATUS !== 'passed') blockers.push('NEXT_PARITY_OBSERVATION_STATUS=passed is required.');
if (process.env.NEXT_RUNTIME_RETIREMENT_APPROVED !== 'true') blockers.push('NEXT_RUNTIME_RETIREMENT_APPROVED=true is required for deletion.');
if (expressFiles.length) blockers.push(`Express runtime references remain in ${new Set(expressFiles).size} files.`);
if (viteFiles.length) blockers.push(`Vite/legacy client references remain in ${new Set(viteFiles).size} files.`);
if (nextRouteFiles.length < 10) blockers.push(`Only ${nextRouteFiles.length} Next route files were found; verify the route inventory before retirement.`);

if (blockers.length) {
  console.error('Next.js runtime retirement gate blocked:');
  for (const blocker of blockers) console.error(`- ${blocker}`);
  if (expressFiles.length) console.error(`Express files: ${[...new Set(expressFiles)].sort().join(', ')}`);
  if (viteFiles.length) console.error(`Legacy/Vite files: ${[...new Set(viteFiles)].sort().join(', ')}`);
  process.exit(1);
}

console.log('Next.js runtime retirement gate passed.');

