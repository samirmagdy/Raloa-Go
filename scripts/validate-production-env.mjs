import { inspectProductionEnvironment, REQUIRED_PRODUCTION_VARIABLES, OPTIONAL_PRODUCTION_VARIABLES } from '../server-config.mjs';

const result = inspectProductionEnvironment(process.env);
const missing = result.missing.length ? `Missing required variables: ${result.missing.join(', ')}` : '';
const invalid = result.invalid.filter((message) => !message.startsWith('NODE_ENV must be')).map((message) => `Invalid configuration: ${message}`).join('\n');

if (process.env.NODE_ENV !== 'production' || missing || invalid) {
  console.error('Production configuration validation failed.');
  if (process.env.NODE_ENV !== 'production') console.error('Invalid configuration: NODE_ENV must be exactly production.');
  if (missing) console.error(missing);
  if (invalid) console.error(invalid);
  process.exit(1);
}

const optional = OPTIONAL_PRODUCTION_VARIABLES.filter((name) => result.optionalMissing.includes(name));
console.log(`Production configuration is valid. Required variables checked: ${REQUIRED_PRODUCTION_VARIABLES.length}.`);
if (optional.length) console.log(`Optional integrations not configured: ${optional.join(', ')}`);
