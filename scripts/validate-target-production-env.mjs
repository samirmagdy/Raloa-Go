import { inspectTargetEnvironment } from '../server-config.mjs';

const role = process.env.SERVICE_ROLE === 'background-worker' ? 'worker' : 'api';
const result = inspectTargetEnvironment(process.env, role);

if (result.missing.length || result.invalid.length) {
  console.error('[target-config] Invalid target architecture configuration.');
  if (result.missing.length) console.error(`Missing: ${result.missing.join(', ')}`);
  for (const message of result.invalid) console.error(`Invalid: ${message}`);
  process.exit(1);
}

console.log(`[target-config] ${role} configuration is structurally valid. No provider connectivity was attempted.`);
