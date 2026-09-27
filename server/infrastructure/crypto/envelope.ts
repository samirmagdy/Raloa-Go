import crypto from 'node:crypto';
import { KeyManagementServiceClient } from '@google-cloud/kms';

export const ENVELOPE_VERSION = 'v1';
const PREFIX = 'raloa.enc';

export interface KmsClient {
  encrypt(request: { name: string; plaintext: Buffer }): Promise<unknown>;
  decrypt(request: { name: string; ciphertext: Buffer }): Promise<unknown>;
}

export interface EnvelopeCipherOptions {
  keyName?: string;
  localKey?: string;
  kms?: KmsClient;
  environment?: NodeJS.ProcessEnv;
}

function bytes(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === 'string') return Buffer.from(value, 'base64');
  throw new Error('INVALID_KMS_RESPONSE');
}

function responsePayload(response: unknown, field: 'ciphertext' | 'plaintext'): Buffer {
  const first = (response as Array<Record<string, unknown>>)[0];
  return bytes(first?.[field]);
}

function b64(value: Buffer): string { return value.toString('base64url'); }
function unb64(value: string): Buffer { return Buffer.from(value, 'base64url'); }

function localMasterKey(options: EnvelopeCipherOptions): Buffer {
  const env = options.environment || process.env;
  const secret = options.localKey || env.INTEGRATION_ENCRYPTION_KEY || env.AUTH_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('INTEGRATION_ENCRYPTION_KEY_NOT_CONFIGURED');
  return crypto.createHash('sha256').update(secret).digest();
}

function localWrap(dek: Buffer, master: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', master, iv);
  const ciphertext = Buffer.concat([cipher.update(dek), cipher.final()]);
  return [b64(iv), b64(cipher.getAuthTag()), b64(ciphertext)].join('.');
}

function localUnwrap(value: string, master: Buffer): Buffer {
  const [ivValue, tagValue, ciphertextValue] = value.split('.');
  if (!ivValue || !tagValue || !ciphertextValue) throw new Error('INVALID_ENCRYPTED_KEY_ENVELOPE');
  const decipher = crypto.createDecipheriv('aes-256-gcm', master, unb64(ivValue));
  decipher.setAuthTag(unb64(tagValue));
  return Buffer.concat([decipher.update(unb64(ciphertextValue)), decipher.final()]);
}

function decryptLegacy(value: string, secret: string, errorCode: string): string {
  const [ivValue, tagValue, ciphertextValue] = value.split('.');
  if (!ivValue || !tagValue || !ciphertextValue) throw new Error(errorCode);
  const decipher = crypto.createDecipheriv('aes-256-gcm', crypto.createHash('sha256').update(secret).digest(), unb64(ivValue));
  decipher.setAuthTag(unb64(tagValue));
  return Buffer.concat([decipher.update(unb64(ciphertextValue)), decipher.final()]).toString('utf8');
}

export function createEnvelopeCipher(options: EnvelopeCipherOptions = {}) {
  const env = options.environment || process.env;
  const keyName = options.keyName || env.INTEGRATION_KMS_KEY_NAME || '';
  const kms = options.kms || (keyName ? new KeyManagementServiceClient() : undefined);
  const production = env.NODE_ENV === 'production';
  if (production && (!keyName || !kms)) throw new Error('INTEGRATION_KMS_KEY_NOT_CONFIGURED');

  return {
    async encrypt(plaintext: string, purpose = 'oauth-token'): Promise<string> {
      const dek = crypto.randomBytes(32);
      const wrappedKey = kms && keyName
        ? b64(responsePayload(await kms.encrypt({ name: keyName, plaintext: dek }), 'ciphertext'))
        : localWrap(dek, localMasterKey(options));
      const keyRef = kms && keyName ? keyName : 'local-v1';
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
      cipher.setAAD(Buffer.from(`${PREFIX}.${ENVELOPE_VERSION}.${purpose}`, 'utf8'));
      const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      return [PREFIX, ENVELOPE_VERSION, b64(Buffer.from(keyRef, 'utf8')), b64(Buffer.from(wrappedKey, 'utf8')), b64(iv), b64(cipher.getAuthTag()), b64(ciphertext)].join('.');
    },
    async decrypt(envelope: string, purpose = 'oauth-token'): Promise<string> {
      // Read the pre-envelope AES-GCM format during the bounded migration
      // window. New writes always use the versioned envelope below.
      if (envelope.split('.').length === 3) {
        const legacySecret = env.INTEGRATION_LEGACY_ENCRYPTION_KEY || env.INTEGRATION_ENCRYPTION_KEY || (env.NODE_ENV !== 'production' ? env.AUTH_SESSION_SECRET : '');
        if (!legacySecret || legacySecret.length < 32) throw new Error('LEGACY_ENCRYPTION_KEY_NOT_CONFIGURED');
        return decryptLegacy(envelope, legacySecret, 'INVALID_LEGACY_TOKEN');
      }
      const [brand, encoding, version, keyRefValue, wrappedValue, ivValue, tagValue, ciphertextValue] = envelope.split('.');
      if (`${brand}.${encoding}` !== PREFIX || version !== ENVELOPE_VERSION || !keyRefValue || !wrappedValue || !ivValue || !tagValue || !ciphertextValue) throw new Error('INVALID_ENCRYPTED_TOKEN_ENVELOPE');
      const keyRef = unb64(keyRefValue).toString('utf8');
      const wrappedKey = unb64(wrappedValue).toString('utf8');
      const dek = keyRef === 'local-v1'
        ? localUnwrap(wrappedKey, localMasterKey(options))
        : responsePayload(await (kms || new KeyManagementServiceClient()).decrypt({ name: keyRef, ciphertext: unb64(wrappedKey) }), 'plaintext');
      const decipher = crypto.createDecipheriv('aes-256-gcm', dek, unb64(ivValue));
      decipher.setAAD(Buffer.from(`${PREFIX}.${version}.${purpose}`, 'utf8'));
      decipher.setAuthTag(unb64(tagValue));
      return Buffer.concat([decipher.update(unb64(ciphertextValue)), decipher.final()]).toString('utf8');
    },
    async rewrap(envelope: string, purpose = 'oauth-token'): Promise<string> {
      return this.encrypt(await this.decrypt(envelope, purpose), purpose);
    }
  };
}

export const integrationEnvelopeCipher = createEnvelopeCipher();
