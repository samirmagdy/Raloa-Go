import type { MediaMetadataRepository, MediaProcessor, MediaStorageAdapter } from './contracts';

export type MediaProcessingResult = 'processed' | 'already_complete' | 'not_found' | 'failed';

export async function processMediaAsset(dependencies: {
  assetId: string;
  metadata: MediaMetadataRepository;
  storage: MediaStorageAdapter;
  processor: MediaProcessor;
  loadOriginal(objectKey: string): Promise<Uint8Array>;
  clock?: () => string;
}): Promise<MediaProcessingResult> {
  const clock = dependencies.clock ?? (() => new Date().toISOString());
  const asset = await dependencies.metadata.get(dependencies.assetId);
  if (!asset) return 'not_found';
  if (asset.lifecycle === 'ready' || asset.lifecycle === 'deleted') return 'already_complete';
  try {
    const bytes = await dependencies.loadOriginal(asset.original.objectKey);
    const result = await dependencies.processor.process({ asset, bytes });
    const processedKey = `sites/${asset.siteId}/media/${asset.id}/processed`;
    const thumbnailKey = `sites/${asset.siteId}/media/${asset.id}/thumbnail`;
    const [processed, thumbnail] = await Promise.all([
      dependencies.storage.put({ objectKey: processedKey, bytes: result.processed.bytes, contentType: result.processed.contentType, cacheControl: 'public,max-age=31536000,immutable' }),
      dependencies.storage.put({ objectKey: thumbnailKey, bytes: result.thumbnail.bytes, contentType: result.thumbnail.contentType, cacheControl: 'public,max-age=31536000,immutable' })
    ]);
    await dependencies.metadata.update(asset.id, { lifecycle: 'ready', processed, thumbnail, width: result.width, height: result.height, updatedAt: clock() });
    return 'processed';
  } catch (error) {
    await dependencies.metadata.update(asset.id, { lifecycle: 'failed', updatedAt: clock() });
    return 'failed';
  }
}
