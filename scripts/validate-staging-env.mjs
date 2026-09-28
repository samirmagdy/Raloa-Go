import { inspectStagingEnvironment, inspectTargetEnvironment, REQUIRED_STAGING_VARIABLES } from '../server-config.mjs';

if (process.env.POSTGRES_APPLICATION_DATASTORE_ONLY === 'true') {
  const target = inspectTargetEnvironment(process.env, process.env.SERVICE_ROLE === 'background-worker' ? 'worker' : 'api');
  if (target.missing.length || target.invalid.length) {
    console.error('Target staging configuration validation failed.');
    if (target.missing.length) console.error(`Missing: ${target.missing.join(', ')}`);
    for (const message of target.invalid) console.error(`Invalid: ${message}`);
    process.exit(1);
  }
  console.log('Target staging configuration is structurally valid.');
  process.exit(0);
}

const result = inspectStagingEnvironment(process.env);
if (result.missing.length || result.invalid.length) {
  console.error('Staging configuration validation failed.');
  if (result.missing.length) console.error(`Missing required variables or managed secrets: ${result.missing.join(', ')}`);
  for (const message of result.invalid) console.error(`Invalid configuration: ${message}`);
  process.exit(1);
}

console.log(`Staging configuration is valid. Real-provider variables checked: ${REQUIRED_STAGING_VARIABLES.length}.`);
