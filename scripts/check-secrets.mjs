import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const clientSecretNames = /(?:STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|CLOUDFLARE_API_TOKEN|INTEGRATION_ENCRYPTION_KEY|AUTH_SESSION_SECRET|GOOGLE_CALENDAR_CLIENT_SECRET|MICROSOFT_CALENDAR_CLIENT_SECRET|GITHUB_CLIENT_SECRET|RESEND_API_KEY)/;
const secretValues = /(sk_(?:live|test)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|-----BEGIN [A-Z ]+ PRIVATE KEY-----)/;
const violations = [];

for (const file of files) {
  if (!fs.statSync(file).isFile()) continue;
  if (file === '.env.example' || file.startsWith('test-')) continue;
  if (file.startsWith('src/') && clientSecretNames.test(fs.readFileSync(file, 'utf8'))) violations.push(`${file}: client code references a server-only secret name`);
  if (!file.endsWith('.lock') && secretValues.test(fs.readFileSync(file, 'utf8'))) violations.push(`${file}: tracked secret-like value detected`);
}
if (violations.length) {
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log(`secret scan passed (${files.length} tracked files)`);
