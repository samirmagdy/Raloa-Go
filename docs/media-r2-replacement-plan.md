# Firebase Storage to R2 replacement plan

Status: **prepared, not cut over**

## File-by-file inventory

| File | Current path | Classification | R2 replacement |
| --- | --- | --- | --- |
| `server-services.ts` | Firebase Admin Storage bootstrap and bucket | provider bootstrap | `createCloudflareR2StorageAdapterFromEnv`; remove bucket initialization after gate |
| `server.ts` | legacy multipart upload writes originals/optimized/thumbnails | upload, thumbnail, gallery/product media | `MediaService.beginUpload` → signed upload → `completeUpload` → media processing worker |
| `server.ts` | `signedMediaUrl` and public media URL helpers | signed URL, download | R2 adapter `getSignedUrl`/CDN URL through MediaService |
| `server.ts` | `deleteMediaAsset`, cleanup/sweep | delete, cleanup | MediaService ownership check plus R2 variant deletion |
| `server/adapters/media-storage.ts` | Firebase adapter and R2 adapter | provider adapter | Keep R2 adapter; archive Firebase adapter after migration |
| `server/domains/media/contracts.ts` | `firebase_storage` provider union | provider contract | Remove Firebase provider value after all metadata is reconciled |
| `server/domains/media/media-service.ts` | provider-independent upload/delete/cleanup | upload authorization, object keys, ownership | Already R2-capable; add quota/dimension policy at application boundary |
| `server/domains/media/processing-worker.ts` | processed/thumbnail variant generation | thumbnail/variants | Already provider-independent; uses stable R2 keys |
| `server/infrastructure/postgres/media-repository.ts` | media metadata and variant rows | metadata | PostgreSQL implementation exists; replace fixed list caps with cursor/batch methods |
| `server/repositories/firestore.ts` | Firestore `media_assets` metadata | migration fallback | Use only as migration source, then archive |
| `scripts/migrate-media.ts` | downloads Firebase objects and uploads to R2 | migration-only | Extend with paged source reads, object manifest, ownership checks, and dry-run |
| `src/lib/firebase.ts` | Firebase client Storage initialization | Firebase Storage client | Remove Storage imports while retaining Firebase Auth |
| `src/components/modals/AccountSettingsModal.tsx` | avatar upload/download/delete | avatar | Call authenticated MediaService/API with `purpose=avatar` |
| `storage.rules` | Firebase Storage rules | configuration/rules | Archive for migration evidence, remove from deployment after gate |
| `firebase-applet-config.json` | Firebase `storageBucket` config | configuration | Remove bucket field only after all Firebase Auth consumers are verified |
| `deploy/cloud-run/*.yaml` | `FIREBASE_STORAGE_BUCKET` | deployment config | Remove after R2-only staging/production smoke tests |
| `.env.example` / CI config | Storage bucket variables | environment config | Remove Firebase Storage variables; retain Firebase Auth variables |

## Capability coverage

| Capability | Current R2 coverage | Remaining work |
| --- | --- | --- |
| Upload authorization | owner/site checks in MediaService | Ensure every route uses service, not legacy multipart path |
| Stable keys | `sites/{site}/media/{asset}/{variant}` | Use shared key helper everywhere |
| MIME/size validation | MIME and byte validation | Add image-dimension validation before accepting completion |
| Ownership | PostgreSQL owner/site joins | Add cross-tenant integration fixtures |
| Public/signed URLs | R2 CDN and presigned URLs | Route all consumers through MediaService |
| Deletion | original/processed/thumbnail deletion | Verify idempotent deletion and orphan cleanup in staging |
| Metadata | PostgreSQL media assets/variants | Reconcile all legacy metadata and counts |
| Variants | processing worker creates processed/thumbnail | Validate avatar/gallery/product renderers consume variants |
| Cleanup | abandoned and orphan cleanup | Page R2 listings and add dry-run report |
| Avatars/galleries/products | purpose model supports all three | Migrate browser avatar path and validate public rendering |
