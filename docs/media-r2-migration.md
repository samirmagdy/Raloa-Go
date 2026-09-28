# Media storage migration

Media bytes are behind `MediaStorageAdapter`; metadata and lifecycle state are
owned by PostgreSQL. `createCloudflareR2StorageAdapterFromEnv` uses the R2
S3-compatible API and keeps access keys server-side. Browser uploads receive a
short-lived presigned `PUT` URL and never receive R2 credentials.

## Stable keys

Objects use `sites/{siteId}/media/{assetId}/{variant}`. Variants are
`original`, `processed`, and `thumbnail`. Asset ownership is resolved through
`app_users.external_auth_id` and the site foreign-key relationship, so a
different user cannot read, sign, update, or delete the asset.

## PostgreSQL path

Set `MEDIA_R2_AUTHORITATIVE=true` only after PostgreSQL and R2 configuration
are available. The new direct-upload endpoints are:

- `POST /api/media/upload-url`
- `POST /api/media/upload-complete`

Existing multipart Firebase routes remain the fallback until validation is
complete. R2 metadata uses `pending_upload`, `processing`, `ready`, `failed`,
and `deleted` lifecycle states. Media processing remains asynchronous and
idempotent through the background-job queue.

## Migration and verification

Run `npm run migrate:media` with `MEDIA_MIGRATION_DRY_RUN=true` first, then run
it without dry-run. The script copies Firebase objects, writes PostgreSQL
metadata, emits a JSON report, and verifies migrated records have R2 CDN URLs.
Use `MEDIA_MIGRATION_VERIFY_ONLY=true` to compare the current Firestore count
with R2/PostgreSQL metadata before changing the feature flag. Keep Firebase
Storage until counts, representative URLs, ownership checks, and processed
thumbnail responses match in staging and production.
