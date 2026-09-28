export type MediaPurpose = 'gallery' | 'product' | 'background' | 'block' | 'avatar';
export type MediaLifecycle = 'pending_upload' | 'uploaded' | 'processing' | 'ready' | 'failed' | 'deleted';
export type MediaVariantKind = 'original' | 'processed' | 'thumbnail';

export function mediaObjectKey(input: { siteId: string; assetId: string; variant?: MediaVariantKind }): string {
  const siteId = input.siteId.trim();
  const assetId = input.assetId.trim();
  if (!siteId || !assetId || /[^a-zA-Z0-9_-]/.test(siteId) || /[^a-zA-Z0-9_-]/.test(assetId)) throw new Error('INVALID_MEDIA_OBJECT_ID');
  return `sites/${siteId}/media/${assetId}/${input.variant || 'original'}`;
}

export type MediaObject = {
  provider: 'firebase_storage' | 'cloudflare_r2';
  objectKey: string;
  contentType: string;
  bytes: number;
  checksum?: string;
  cdnUrl?: string;
};

export type MediaAsset = {
  id: string;
  ownerUserId: string;
  siteId: string;
  purpose: MediaPurpose;
  lifecycle: MediaLifecycle;
  original: MediaObject;
  processed?: MediaObject;
  thumbnail?: MediaObject;
  width?: number;
  height?: number;
  altText?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

export interface MediaMetadataRepository {
  create(asset: MediaAsset): Promise<void>;
  get(id: string): Promise<MediaAsset | null>;
  listOwned(ownerUserId: string, siteId: string): Promise<MediaAsset[]>;
  listAll(ownerUserId?: string, siteId?: string): Promise<MediaAsset[]>;
  listAbandoned(cutoff: string, ownerUserId?: string, siteId?: string): Promise<MediaAsset[]>;
  remove(id: string): Promise<void>;
  update(id: string, changes: Partial<MediaAsset>): Promise<MediaAsset>;
}

export interface MediaStorageAdapter {
  readonly provider: MediaObject['provider'];
  put(input: { objectKey: string; bytes: Uint8Array; contentType: string; cacheControl?: string }): Promise<MediaObject>;
  delete(objectKey: string): Promise<void>;
  listKeys(prefix: string): Promise<string[]>;
  getCdnUrl(objectKey: string): string;
  createUploadUrl?(input: { objectKey: string; contentType: string; expiresInSeconds: number }): Promise<{ url: string; expiresAt: string; headers: Record<string, string> }>;
  getSignedUrl?(objectKey: string, expiresInSeconds: number): Promise<{ url: string; expiresAt: string }>;
  getObject?(objectKey: string): Promise<Uint8Array>;
}

export interface MediaProcessor {
  process(input: { asset: MediaAsset; bytes: Uint8Array }): Promise<{
    processed: { bytes: Uint8Array; contentType: string };
    thumbnail: { bytes: Uint8Array; contentType: string };
    width?: number;
    height?: number;
  }>;
}

export interface MediaProcessingQueue {
  enqueue(input: { assetId: string; idempotencyKey: string }): Promise<void>;
}

export interface MediaService {
  beginUpload(input: { id: string; ownerUserId: string; siteId: string; purpose: MediaPurpose; contentType: string; maxBytes?: number }): Promise<MediaAsset>;
  createUploadUrl(input: { assetId: string; ownerUserId: string; expiresInSeconds?: number }): Promise<{ url: string; objectKey: string; expiresAt: string; headers: Record<string, string> }>;
  completeUpload(input: { assetId: string; ownerUserId: string; bytes: Uint8Array; checksum?: string; maxBytes?: number }): Promise<MediaAsset>;
  list(ownerUserId: string, siteId: string): Promise<MediaAsset[]>;
  remove(input: { assetId: string; ownerUserId: string }): Promise<void>;
  cleanup(input: { now?: string; abandonedAfterMs: number; ownerUserId?: string; siteId?: string }): Promise<{ abandoned: number; orphaned: number }>;
}
