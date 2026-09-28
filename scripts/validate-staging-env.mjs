import { inspectStagingEnvironment, REQUIRED_STAGING_VARIABLES } from '../server-config.mjs';

const result = inspectStagingEnvironment(process.env);
if (result.missing.length || result.invalid.length) {
  console.error('Staging configuration validation failed.');
  if (result.missing.length) console.error(`Missing required variables or managed secrets: ${result.missing.join(', ')}`);
  for (const message of result.invalid) console.error(`Invalid configuration: ${message}`);
  process.exit(1);
}

console.log(`Staging configuration is valid. Real-provider variables checked: ${REQUIRED_STAGING_VARIABLES.length}.`);
