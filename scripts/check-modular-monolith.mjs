import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('server/domains');
const requiredDomains = ['sites', 'publishing', 'audience', 'analytics', 'bookings', 'products', 'orders', 'billing', 'domains', 'media', 'integrations', 'inventory', 'subscriptions'];
const failures = [];

for (const domain of requiredDomains) {
  const directory = path.join(root, domain);
  if (!fs.existsSync(path.join(directory, 'index.ts'))) failures.push(`${domain}: missing module index`);
  if (!fs.existsSync(directory)) continue;
  if (!fs.existsSync(path.join(directory, 'service.ts')) && !fs.readdirSync(directory).some((file) => file.endsWith('-service.ts'))) failures.push(`${domain}: missing application service`);
  for (const file of fs.readdirSync(directory).filter((entry) => entry.endsWith('.ts') && !entry.endsWith('.test.ts'))) {
    const filename = path.join(directory, file);
    const source = fs.readFileSync(filename, 'utf8');
    if (!file.endsWith('controller.ts') && !file.endsWith('index.ts') && /from ['"]express['"]|from ['"]firebase-admin|from ['"](?:pg|drizzle-orm)/.test(source)) {
      failures.push(`${domain}/${file}: transport/persistence provider import must stay at the composition or adapter boundary`);
    }
    const otherDomainImport = source.match(/server\/domains\/([^/'"]+)/g)?.find((entry) => !entry.endsWith(`server/domains/${domain}`));
    if (otherDomainImport) failures.push(`${domain}/${file}: direct cross-domain import ${otherDomainImport}`);
  }
}

for (const required of ['server/modules.ts', 'server/background-jobs', 'server/outbox', 'server/repositories/contracts.ts']) {
  if (!fs.existsSync(required)) failures.push(`missing modular-monolith boundary: ${required}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('modular monolith boundary passed');
