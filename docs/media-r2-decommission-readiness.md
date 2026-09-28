# Media R2 decommission readiness

Status: **blocked — do not remove Firebase Storage yet**

The repository does not contain the completed migration evidence required to remove Firebase Storage safely. Firebase Auth is intentionally retained and is not part of this decommission.

## Current blockers

The following active paths still use Firebase Storage or legacy media metadata:

| Area | Evidence | Required before cleanup |
| --- | --- | --- |
| Server bootstrap | `server-services.ts` initializes `firebase-admin/storage` from `FIREBASE_STORAGE_BUCKET` | Remove the Firebase Storage bootstrap after all callers are migrated to `MediaService`/R2 |
| Legacy media API | `server.ts` still signs, uploads, and deletes Firebase Storage objects in compatibility routes | Prove API parity through R2, then remove the legacy implementation |
| Browser avatar flow | `src/lib/firebase.ts` and `AccountSettingsModal.tsx` use the Firebase Storage SDK | Route avatar uploads/deletes through the authenticated media API |
| Migration tooling | `scripts/migrate-media.ts` still reads Firestore metadata and downloads Firebase objects | Run the final migration, archive the source metadata, then retire the importer |
| Rules/configuration | `storage.rules`, Firebase bucket configuration, and deployment environment variables remain | Remove only after the production/staging paths no longer require the bucket |
| Adapter layer | `server/adapters/media-storage.ts` still exposes a Firebase Storage adapter/provider | Keep only the R2 adapter and provider-independent contract |

## Required reconciliation evidence

The migration is not complete until a versioned report records all of the following for the same cutover checkpoint:

1. **Object counts:** every source object and every R2 original/variant is accounted for; skipped, duplicate, failed, and orphaned objects are zero or explicitly explained.
2. **URLs:** every persisted media record resolves to the expected R2/CDN URL, with no Firebase bucket URLs in authoritative records.
3. **Ownership:** tenant/site/user ownership matches source metadata and cross-tenant access tests are negative.
4. **Public rendering:** representative published pages render original, thumbnail, and optimized assets from R2/CDN URLs.
5. **Deletion:** authorized deletion removes metadata and all owned R2 variants; unauthorized and repeated deletes are safe.
6. **Uploads:** authenticated uploads enforce MIME, byte, image-dimension, quota, ownership, and processing-state rules.
7. **Metadata archive:** the final legacy metadata export is immutable, restorable/listable, and has a documented retention URI.

The report must include the migration checkpoint, tenant/site scope, source and target counts, checksums or stable object identifiers, failed-item details, and the observation window with no Firebase Storage fallback traffic.

## Cleanup sequence

1. Freeze media writes briefly and run the final source-to-R2 reconciliation.
2. Verify the evidence above in staging and production-like tests.
3. Switch all reads and writes to the R2-backed `MediaService`.
4. Export/archive legacy metadata and verify the archive.
5. Run the decommission gate: `npm run check:media-r2-decommission`.
6. In a separate reviewed change, remove Firebase Storage routes, adapters, imports, rules, bucket configuration, and unused environment variables.
7. Rerun lint, build, API/media tests, public rendering tests, security tests, and the complete regression suite.

No step in this readiness document deletes Firebase objects or metadata. Firebase Auth (`firebase/auth` and `firebase-admin/auth`) must remain installed and configured after cleanup.

