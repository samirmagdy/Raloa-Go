export type MediaPurpose = 'gallery' | 'product' | 'background' | 'block' | 'avatar';
export type MediaLifecycle = 'pending_upload' | 'uploaded' | 'processing' | 'ready' | 'failed' | 'deleted';
export type MediaVariantKind = 'original' | 'processed' | 'thumbnail';

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
  update(id: string, changes: Partial<MediaAsset>): Promise<MediaAsset>;
}

export interface MediaStorageAdapter {
  readonly provider: MediaObject['provider'];
  put(input: { objectKey: string; bytes: Uint8Array; contentType: string; cacheControl?: string }): Promise<MediaObject>;
  delete(objectKey: string): Promise<void>;
  getCdnUrl(objectKey: string): string;
}

export interface MediaProcessingQueue {
  enqueue(input: { assetId: string; idempotencyKey: string }): Promise<void>;
}

export interface MediaService {
  beginUpload(input: { id: string; ownerUserId: string; siteId: string; purpose: MediaPurpose; contentType: string }): Promise<MediaAsset>;
  completeUpload(input: { assetId: string; ownerUserId: string; bytes: Uint8Array; checksum?: string }): Promise<MediaAsset>;
  list(ownerUserId: string, siteId: string): Promise<MediaAsset[]>;
  remove(input: { assetId: string; ownerUserId: string }): Promise<void>;
}
