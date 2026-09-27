import assert from 'node:assert/strict';
import { assertPostgresRuntimeAllowed, readPostgresRuntimeConfig } from './server/infrastructure/postgres/config';

const config = readPostgresRuntimeConfig({ POSTGRES_DATABASE_URL: 'postgresql://raloa:test@localhost/raloa', POSTGRES_SSL: 'false', POSTGRES_POOL_MAX: '12', POSTGRES_APPLICATION_NAME: 'test' });
assert.equal(config.connectionString, 'postgresql://raloa:test@localhost/raloa');
assert.equal(config.max, 12);
assert.equal(config.ssl, false);
assert.throws(() => readPostgresRuntimeConfig({ POSTGRES_DATABASE_URL: 'postgresql://localhost/db', POSTGRES_POOL_MAX: '0' }), /INVALID_POSTGRES_POOL_MAX/);
assert.doesNotThrow(() => assertPostgresRuntimeAllowed({ NODE_ENV: 'test' }));
assert.throws(() => assertPostgresRuntimeAllowed({ NODE_ENV: 'production', POSTGRES_ENABLED: 'false' }), /POSTGRES_NOT_ENABLED_FOR_PRODUCTION/);
console.log('PostgreSQL local configuration tests passed');
