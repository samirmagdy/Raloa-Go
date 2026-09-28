import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const docsDir = path.join(root, 'docs/api/endpoints');
const sourceFiles = ['server.ts', 'worker.ts'];
const routeFiles = [];
function walk(directory, collectSource = false) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file, collectSource);
    else {
      if (collectSource && entry.name.endsWith('.ts')) sourceFiles.push(file);
      if (entry.name === 'route.ts' || entry.name === 'route.tsx') routeFiles.push(file);
    }
  }
}
walk(path.join(root, 'apps'));
walk(path.join(root, 'server'), true);
for (const file of fs.readdirSync(root)) if (/^(server|worker)\.(ts|tsx)$/.test(file)) sourceFiles.push(file);

const normalize = (route) => route.replace(/\{[^}]+\}/g, '*').replace(/:([A-Za-z0-9_]+)/g, '*').replace(/\[\.\.\.[^\]]+\]/g, '*').replace(/\[[^\]]+\]/g, '*').replace(/\/+/g, '/').replace(/\/$/, '') || '/';
const isApiRoute = (route) => ['/health', '/robots.txt', '/sitemap.xml', '/llms.txt'].includes(route) || route.startsWith('/api/') || route.startsWith('/internal/') || route.startsWith('/tasks/');
const routes = new Set();
for (const relative of sourceFiles) {
  const file = path.isAbsolute(relative) ? relative : path.join(root, relative);
  if (!fs.existsSync(file)) continue;
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/\bapp\.(get|post|put|patch|delete)\(\s*['\"]([^'\"]+)/gi)) if (isApiRoute(normalize(match[2]))) routes.add(`${match[1].toUpperCase()} ${normalize(match[2])}`);
}
for (const file of routeFiles) {
  const relative = path.relative(root, file).replaceAll(path.sep, '/');
  const marker = relative.indexOf('/src/app/');
  if (marker < 0) continue;
  const routePath = '/' + relative.slice(marker + '/src/app/'.length).replace(/\/route\.tsx?$/, '').split('/').filter((part) => !/^\([^)]*\)$/.test(part)).join('/');
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)) routes.add(`${match[1]} ${normalize(routePath)}`);
}

const docs = new Set();
for (const file of fs.readdirSync(docsDir).filter((name) => name.endsWith('.md'))) {
  const source = fs.readFileSync(path.join(docsDir, file), 'utf8');
  const method = source.match(/^method:\s*(\w+)/m)?.[1]?.toUpperCase();
  const route = source.match(/^path:\s*(.+)$/m)?.[1]?.trim();
  if (method && route) docs.add(`${method} ${normalize(route)}`);
}
const missing = [...routes].filter((route) => !docs.has(route)).sort();
const stale = [...docs].filter((route) => !routes.has(route)).sort();
if (missing.length || stale.length) {
  if (missing.length) console.error(`Undocumented live API routes:\n${missing.map((route) => `  - ${route}`).join('\n')}`);
  if (stale.length) console.error(`Contract docs without a discovered live route:\n${stale.map((route) => `  - ${route}`).join('\n')}`);
  process.exit(1);
}
console.log(`API contract inventory passed: ${routes.size} live routes documented.`);
