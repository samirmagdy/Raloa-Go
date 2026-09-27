import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const domainsRoot = path.join(root, 'server', 'domains');
const forbidden = [
  /from ['"]stripe(?:\/|['"])/,
  /from ['"]firebase-admin\/(auth|storage|app)(?:\/|['"])/,
  /from ['"](@google-cloud|googleapis|@microsoft)(?:\/|['"])/,
  /from ['"]nodemailer(?:\/|['"])/,
  /from ['"]firebase\/(auth|storage)(?:\/|['"])/,
];
const violations = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    if (!entry.isFile() || !/\.ts$/.test(entry.name)) continue;
    const relative = path.relative(root, file);
    const source = fs.readFileSync(file, 'utf8');
    source.split('\n').forEach((line, index) => {
      if (forbidden.some((pattern) => pattern.test(line))) violations.push(`${relative}:${index + 1}`);
    });
  }
}

if (fs.existsSync(domainsRoot)) walk(domainsRoot);
if (violations.length) {
  console.error('External provider SDKs must stay behind server/adapters or infrastructure ports:\n' + violations.join('\n'));
  process.exit(1);
}
console.log('Provider boundary passed');

