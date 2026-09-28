import { inspectMigrationEnvironment } from '../server-config.mjs';

const result = inspectMigrationEnvironment(process.env);
if (result.missing.length || result.invalid.length) {
  console.error('[migration-config] Migration configuration is incomplete.');
  if (result.missing.length) console.error(`Missing: ${result.missing.join(', ')}`);
  for (const message of result.invalid) console.error(`Invalid: ${message}`);
  process.exit(1);
}

console.log(`[migration-config] Configuration is structurally valid; dry-run=${process.env.MIGRATION_DRY_RUN !== 'false'}. No migration was executed.`);
