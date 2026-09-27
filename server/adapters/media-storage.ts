import type { MediaObject, MediaStorageAdapter } from '../domains/media/contracts';

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
