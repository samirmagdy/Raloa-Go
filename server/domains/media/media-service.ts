import { mediaObjectKey, type MediaAsset, type MediaMetadataRepository, type MediaProcessingQueue, type MediaService, type MediaStorageAdapter } from './contracts';

const allowedContentTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
export function validateMediaContentType(contentType: string): void { if (!allowedContentTypes.has(contentType)) throw new Error('UNSUPPORTED_MEDIA_TYPE'); }

export function validateMediaUpload(input: { contentType: string; bytes: number; maxBytes: number }): void {
  if (!allowedContentTypes.has(input.contentType)) throw new Error('Unsupported media type');
  if (!Number.isSafeInteger(input.bytes) || input.bytes <= 0 || input.bytes > input.maxBytes) throw new Error('Invalid media size');
}

export function createMediaDomainService(dependencies: {
  metadata: MediaMetadataRepository;
  storage: MediaStorageAdapter;
  processing: MediaProcessingQueue;
  clock?: () => string;
}): MediaService {
  const clock = dependencies.clock ?? (() => new Date().toISOString());

  const service: MediaService = {
    async beginUpload(input) {
      validateMediaContentType(input.contentType);
      const timestamp = clock();
      const objectKey = mediaObjectKey({ siteId: input.siteId, assetId: input.id });
      const asset: MediaAsset = {
        id: input.id,
        ownerUserId: input.ownerUserId,
        siteId: input.siteId,
        purpose: input.purpose,
        lifecycle: 'pending_upload',
        original: { provider: dependencies.storage.provider, objectKey, contentType: input.contentType, bytes: 0 },
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await dependencies.metadata.create(asset);
      return asset;
    },
    async createUploadUrl(input) {
      const asset = await dependencies.metadata.get(input.assetId);
      if (!asset || asset.ownerUserId !== input.ownerUserId || asset.lifecycle !== 'pending_upload') throw new Error('MEDIA_NOT_FOUND');
      if (!dependencies.storage.createUploadUrl) throw new Error('DIRECT_UPLOAD_UNAVAILABLE');
      const signed = await dependencies.storage.createUploadUrl({ objectKey: asset.original.objectKey, contentType: asset.original.contentType, expiresInSeconds: Math.min(Math.max(input.expiresInSeconds || 900, 60), 3600) });
      return { ...signed, objectKey: asset.original.objectKey };
    },
    async completeUpload(input) {
      const asset = await dependencies.metadata.get(input.assetId);
      if (!asset || asset.ownerUserId !== input.ownerUserId || asset.lifecycle === 'deleted') {
        throw new Error('Media asset not found');
      }
      validateMediaUpload({ contentType: asset.original.contentType, bytes: input.bytes.byteLength, maxBytes: input.maxBytes || 25 * 1024 * 1024 });
      const stored = await dependencies.storage.put({
        objectKey: asset.original.objectKey,
        bytes: input.bytes,
        contentType: asset.original.contentType,
        cacheControl: 'public,max-age=31536000,immutable'
      });
      const updated = await dependencies.metadata.update(asset.id, {
        lifecycle: 'processing',
        original: { ...stored, checksum: input.checksum },
        updatedAt: clock()
      });
      await dependencies.processing.enqueue({ assetId: asset.id, idempotencyKey: `media-processing:${asset.id}` });
      return updated;
    },
    list: (ownerUserId, siteId) => dependencies.metadata.listOwned(ownerUserId, siteId),
    async remove(input) {
      const asset = await dependencies.metadata.get(input.assetId);
      if (!asset || asset.ownerUserId !== input.ownerUserId) throw new Error('Media asset not found');
      await dependencies.metadata.update(asset.id, { lifecycle: 'deleted', deletedAt: clock(), updatedAt: clock() });
      await Promise.all([
        dependencies.storage.delete(asset.original.objectKey),
        asset.processed ? dependencies.storage.delete(asset.processed.objectKey) : Promise.resolve(),
        asset.thumbnail ? dependencies.storage.delete(asset.thumbnail.objectKey) : Promise.resolve()
      ]);
    },
    async cleanup(input) {
      const currentTime = input.now ? Date.parse(input.now) : Date.now();
      const cutoff = new Date(currentTime - input.abandonedAfterMs).toISOString();
      const abandoned = await dependencies.metadata.listAbandoned(cutoff, input.ownerUserId, input.siteId);
      for (const asset of abandoned) {
        await dependencies.metadata.remove(asset.id);
        await dependencies.storage.delete(asset.original.objectKey);
      }
      const keys = await dependencies.storage.listKeys(input.siteId ? `sites/${input.siteId}/` : 'sites/');
      const known = new Set((await dependencies.metadata.listAll(input.ownerUserId, input.siteId)).flatMap((asset) => [asset.original.objectKey, asset.processed?.objectKey, asset.thumbnail?.objectKey].filter((key): key is string => Boolean(key))));
      const orphanedKeys = keys.filter((key) => !known.has(key));
      await Promise.all(orphanedKeys.map((key) => dependencies.storage.delete(key)));
      return { abandoned: abandoned.length, orphaned: orphanedKeys.length };
    }
  };
  return service;
}
