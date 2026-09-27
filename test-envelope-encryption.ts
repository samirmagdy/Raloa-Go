import assert from 'node:assert/strict';
import { createEnvelopeCipher } from './server/infrastructure/crypto/envelope';

const environment = { NODE_ENV: 'test', INTEGRATION_ENCRYPTION_KEY: 'local-test-key-with-at-least-32-characters' } as NodeJS.ProcessEnv;
const cipher = createEnvelopeCipher({ environment });
const first = await cipher.encrypt('refresh-token-value');
assert.match(first, /^raloa\.enc\.v1\./);
assert.equal(await cipher.decrypt(first), 'refresh-token-value');
assert.notEqual(first, await cipher.encrypt('refresh-token-value'));
assert.equal(await cipher.decrypt(await cipher.rewrap(first)), 'refresh-token-value');
await assert.rejects(() => cipher.decrypt(first, 'wrong-purpose'), /Unsupported state|unable to authenticate|bad decrypt/);

const kmsCalls: string[] = [];
const kms = {
  async encrypt({ name, plaintext }: { name: string; plaintext: Buffer }) {
    kmsCalls.push(`encrypt:${name}`);
    return [{ ciphertext: plaintext.toString('base64') }];
  },
  async decrypt({ name, ciphertext }: { name: string; ciphertext: Buffer }) {
    kmsCalls.push(`decrypt:${name}`);
    return [{ plaintext: ciphertext.toString('base64') }];
  }
};
const kmsCipher = createEnvelopeCipher({ keyName: 'projects/p/locations/global/keyRings/r/cryptoKeys/integrations', kms, environment });
const kmsEnvelope = await kmsCipher.encrypt('kms-token');
assert.equal(await kmsCipher.decrypt(kmsEnvelope), 'kms-token');
assert.deepEqual(kmsCalls, [
  'encrypt:projects/p/locations/global/keyRings/r/cryptoKeys/integrations',
  'decrypt:projects/p/locations/global/keyRings/r/cryptoKeys/integrations'
]);
console.log('envelope encryption tests passed');
