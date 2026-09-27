import type { MediaAsset, MediaMetadataRepository, MediaProcessingQueue, MediaService, MediaStorageAdapter } from './contracts';

export function createMediaDomainService(dependencies: {
  metadata: MediaMetadataRepository;
  storage: MediaStorageAdapter;
  processing: MediaProcessingQueue;
  clock?: () => string;
}): MediaService {
  const clock = dependencies.clock ?? (() => new Date().toISOString());

  return {
    async beginUpload(input) {
      const timestamp = clock();
      const objectKey = `sites/${input.siteId}/media/${input.id}/original`;
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
    async completeUpload(input) {
      const asset = await dependencies.metadata.get(input.assetId);
      if (!asset || asset.ownerUserId !== input.ownerUserId || asset.lifecycle === 'deleted') {
        throw new Error('Media asset not found');
      }
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
    }
  };
}
