import assert from 'node:assert/strict';
import { loadProductionSecrets, MANAGED_SECRET_ENV_NAMES } from './server/infrastructure/secrets/provider';

const env = { SECRET_MANAGER_ENABLED: 'true', SECRET_MANAGER_PROJECT_ID: 'test-project', POSTGRES_ENABLED: 'true', MEDIA_R2_AUTHORITATIVE: 'true' } as NodeJS.ProcessEnv;
const calls: string[] = [];
const client = {
  accessSecretVersion: async ({ name }: { name: string }) => {
    calls.push(name);
    const key = name.split('/secrets/')[1].split('/')[0];
    return [{ payload: { data: `loaded-${key}` } }];
  }
};
await loadProductionSecrets(env, client);
assert.equal(calls.length, MANAGED_SECRET_ENV_NAMES.length);
assert.equal(env.STRIPE_SECRET_KEY, 'loaded-STRIPE_SECRET_KEY');
assert.equal(env.AUTH_SESSION_SECRET, 'loaded-AUTH_SESSION_SECRET');
await assert.rejects(() => loadProductionSecrets({ SECRET_MANAGER_ENABLED: 'true' } as NodeJS.ProcessEnv, client), /SECRET_MANAGER_PROJECT_ID_NOT_CONFIGURED/);
console.log('secrets provider tests passed');
