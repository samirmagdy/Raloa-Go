# READY FOR CREDENTIALS: migration execution handoff

Status: **ready for credentials, not ready for cutover**

No authority, reconciliation, archive, or decommission gate has been marked passed.

## Remaining Firestore runtime files

The complete 31-file inventory and removal conditions are in [PostgreSQL authority cutover](postgres-authority-cutover.md). The current runtime files are:

```text
server-services.ts
server.ts
server/adapters/firebase.ts
server/audit/firestore.ts
server/background-jobs/firestore-repository.ts
server/core/ownership.ts
server/core/types.ts
server/domains/analytics/index.ts
server/domains/audience/index.ts
server/domains/bookings/calendar-sync-worker.ts
server/domains/bookings/index.ts
server/domains/bookings/migration.ts
server/domains/domains/index.ts
server/domains/domains/verification-worker.ts
server/domains/integrations/index.ts
server/domains/inventory/index.ts
server/domains/media/index.ts
server/domains/notifications/email-worker.ts
server/domains/orders/index.ts
server/domains/products/index.ts
server/domains/sites/index.ts
server/domains/subscriptions/index.ts
server/infrastructure/feature-flags/firestore.ts
server/infrastructure/firestore-oauth-repository.ts
server/infrastructure/firestore-repository.ts
server/infrastructure/migrations/firestore-checkpoint-store.ts
server/modules.ts
server/outbox/firestore.ts
server/repositories/firestore.ts
server/repositories/site-persistence.ts
src/lib/firebase.ts
```

## Remaining Firebase Storage paths

The complete replacement plan is in [Media R2 replacement plan](media-r2-replacement-plan.md). Active paths include server bootstrap, legacy multipart upload, signed/download/delete helpers, cleanup, Firebase Storage adapter, media provider contract, migration importer, browser avatar upload/delete, Storage rules, bucket configuration, and deployment variables.

## Required credentials/configuration

Supply through Secret Manager or an equivalent controlled deployment mechanism; do not commit values:

```text
POSTGRES_DATABASE_URL or DATABASE_URL
POSTGRES_ENABLED=true
POSTGRES_SSL=true for staging/production
FIRESTORE_DATABASE_ID
FIREBASE_PROJECT_ID
FIREBASE_ADMIN_ENABLED=true
CLOUDFLARE_R2_ACCOUNT_ID
CLOUDFLARE_R2_ACCESS_KEY_ID
CLOUDFLARE_R2_SECRET_ACCESS_KEY
CLOUDFLARE_R2_BUCKET
CLOUDFLARE_R2_PUBLIC_BASE_URL
FIRESTORE_ARCHIVE_URI
FIRESTORE_ARCHIVE_MANIFEST
FIRESTORE_RECONCILIATION_REPORT
FIRESTORE_CUTOVER_APPROVAL_FILE
FIRESTORE_CUTOVER_APPROVAL_PUBLIC_KEY
```

Firebase Auth variables and credentials remain required and are not removed.

## Available commands

```bash
npm run migrate:firestore-postgres -- --dry-run
npm run migrate:sites
npm run migrate:audience
npm run migrate:booking-schedules
npm run migrate:bookings -- backfill
npm run migrate:commerce
MEDIA_MIGRATION_DRY_RUN=true npm run migrate:media
npm run reconcile:firestore-postgres
npm run reconcile:media-r2 -- --dry-run
npm run verify:firestore-archive
npm run check:firestore-authority
npm run check:firestore-decommission
npm run check:media-r2-decommission
```

Every live command must fail when credentials are missing. Dry-run and fixture reconciliation commands report intended reads/writes/deletions and conflicts without changing production state.

## Cutover sequence

1. Provision isolated staging credentials and backup/archive destinations.
2. Run all domain migrations in dry-run, then controlled backfill mode.
3. Run row-count, ownership, referential-integrity, semantic, and media-manifest reconciliation.
4. Verify archive manifest, immutable URI, checksum, listability, and restore procedure.
5. Run PostgreSQL booking/commerce concurrency tests against the isolated test database.
6. Observe PostgreSQL reads/writes and R2 media paths with no Firestore/Storage fallback traffic.
7. Produce the signed approval artifact with operator, ticket, expiry, archive URI, and reconciliation report hash.
8. Enable PostgreSQL/R2 authority through controlled deployment configuration, not a browser-controlled flag.
9. Run staging smoke, provider contracts, public rendering, Studio reload, booking, commerce, billing, media, and worker tests.
10. Repeat reconciliation and promote gradually.
11. Archive migration tools outside runtime and remove non-Auth Firestore/Storage code only after the gates pass.
12. Rerun full lint, builds, migrations, unit, domain, HTTP, contract, integration, E2E, and staging suites.

## Rollback sequence

1. Stop the authority rollout and disable affected Cloud Tasks job kinds.
2. Preserve PostgreSQL/R2/Firestore reports and logs; do not delete source data.
3. Restore the previous controlled deployment configuration through the reviewed release mechanism.
4. If a PostgreSQL migration is backward-compatible, deploy the previous application revision; use a forward fix for schema changes.
5. Stop R2 writes only if object/metadata integrity is at risk; preserve already-uploaded objects.
6. Replay idempotent outbox/jobs and Stripe events after the stable revision is healthy.
7. Reconcile again and document all mismatches before retrying.

Rollback commands are documented but intentionally not executed in this phase.

## Current verification

Passed: migration helper tests, migration command dry-run/failure tests, media service/processing tests, provider contract tests, TypeScript check, and diff check.

Expected blocked: authority gate, decommission gate, R2 gate, live reconciliation, archive verification, and production cutover.

