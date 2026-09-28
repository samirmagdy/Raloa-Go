import type { MediaObject, MediaStorageAdapter } from '../domains/media/contracts';
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type FirebaseStorageClient = {
  putObject(input: { objectKey: string; bytes: Uint8Array; contentType: string; cacheControl?: string }): Promise<{ bytes: number; checksum?: string }>;
  deleteObject(objectKey: string): Promise<void>;
  listObjects(prefix: string): Promise<string[]>;
  publicUrl(objectKey: string): string;
};

export type R2StorageClient = FirebaseStorageClient;

export function createFirebaseStorageAdapter(client: FirebaseStorageClient): MediaStorageAdapter {
  return createAdapter('firebase_storage', client);
}

export function createCloudflareR2StorageAdapter(client: R2StorageClient): MediaStorageAdapter {
  return createAdapter('cloudflare_r2', client);
}

export function createCloudflareR2StorageAdapterFromEnv(env: NodeJS.ProcessEnv = process.env): MediaStorageAdapter | null {
  const accountId = env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucket = env.CLOUDFLARE_R2_BUCKET;
  const publicBaseUrl = env.CLOUDFLARE_R2_PUBLIC_BASE_URL?.replace(/\/$/, '');
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) return null;
  const client = new S3Client({ region: 'auto', endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey } });
  const adapter: MediaStorageAdapter = {
    provider: 'cloudflare_r2',
    async put(input) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: input.objectKey, Body: input.bytes, ContentType: input.contentType, CacheControl: input.cacheControl }));
      return { provider: 'cloudflare_r2', objectKey: input.objectKey, contentType: input.contentType, bytes: input.bytes.byteLength, cdnUrl: `${publicBaseUrl}/${input.objectKey}` };
    },
    async delete(objectKey) { await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey })); },
    async listKeys(prefix) {
      const result = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
      return (result.Contents || []).map((object) => object.Key).filter((key): key is string => Boolean(key));
    },
    getCdnUrl: (objectKey) => `${publicBaseUrl}/${objectKey}`,
    async createUploadUrl(input) {
      const expiresIn = Math.min(Math.max(input.expiresInSeconds, 60), 3600);
      const url = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: input.objectKey, ContentType: input.contentType }), { expiresIn });
      return { url, expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(), headers: { 'Content-Type': input.contentType } };
    },
    async getSignedUrl(objectKey, expiresInSeconds) {
      const expiresIn = Math.min(Math.max(expiresInSeconds, 60), 3600);
      const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: objectKey }), { expiresIn });
      return { url, expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() };
    },
    async getObject(objectKey) {
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
      if (!result.Body) throw new Error('MEDIA_OBJECT_NOT_FOUND');
      return new Uint8Array(await result.Body.transformToByteArray());
    }
  };
  return adapter;
}

function createAdapter(provider: MediaObject['provider'], client: FirebaseStorageClient): MediaStorageAdapter {
  return {
    provider,
    async put(input) {
      const result = await client.putObject(input);
      return { provider, objectKey: input.objectKey, contentType: input.contentType, bytes: result.bytes, checksum: result.checksum, cdnUrl: client.publicUrl(input.objectKey) };
    },
    delete: (objectKey) => client.deleteObject(objectKey),
    listKeys: (prefix) => client.listObjects(prefix),
    getCdnUrl: (objectKey) => client.publicUrl(objectKey)
  };
}
