# Raloa Firestore/Firebase Storage → PostgreSQL/R2 operational runbook

Status: **execution procedure only; migration not performed**

This runbook is intentionally fail-closed. The executable entry point is:

```bash
npm run migration:runbook -- --stage=0 --json
```

It is plan-only unless `--execute` is supplied. Stages 5, 7, and 8 never execute deployment or deletion commands automatically. They require evidence, a signed approval artifact, and a separately reviewed deployment. No boolean environment variable is sufficient by itself.

## Required evidence and state

The migration operator must maintain machine-readable reports, not screenshots:

| Evidence | Required value before cutover |
| --- | --- |
| `MIGRATION_COMPLETION_STATUS` | `passed` |
| `FIRESTORE_RECONCILIATION_STATUS` | `passed` |
| `MEDIA_R2_RECONCILIATION_STATUS` | `passed` |
| `FIRESTORE_ARCHIVE_VERIFICATION_STATUS` | `passed` |
| `CRITICAL_MISMATCH_COUNT` | `0` |
| `FIRESTORE_ARCHIVE_URI` | immutable `gs://`, `s3://`, `r2://`, or approved HTTPS URI |
| `OBSERVATION_WINDOW_STATUS` | `passed` before decommission |
| `FIRESTORE_AUTHORITY_CUTOVER_APPROVED` | `true`, only as a technical enforcement flag |
| `FIRESTORE_DECOMMISSION_APPROVED` | `true`, only as a technical enforcement flag |

The approval booleans are enforcement flags, not approval evidence. Authority cutover also requires a signed approval file configured through `AUTHORITY_CUTOVER_APPROVAL_FILE` and `AUTHORITY_CUTOVER_APPROVAL_PUBLIC_KEY`, with operation `authority-cutover`. Decommission requires `FIRESTORE_DECOMMISSION_APPROVED=true` plus a separate signed artifact through `DECOMMISSION_APPROVAL_FILE` and `DECOMMISSION_APPROVAL_PUBLIC_KEY`, with operation `legacy-decommission`. Each approval must bind to the SHA-256 of `RECONCILIATION_ARTIFACT_FILE`.

## Stage 0 — Preconditions

Owner: migration lead and cutover owner.

Confirm all of the following in the target environment:

- PostgreSQL is reachable, the correct isolated database is selected, migrations are applied, pooling is configured, and a tested backup/PITR point exists.
- R2 bucket/CDN is reachable and isolated from production when running staging validation.
- Firestore source and Firebase Storage source are reachable with read-only migration credentials.
- Immutable archive destination is configured and writable by the archive identity.
- Staging validation passes for Studio, public pages, workers, providers, booking, commerce, billing, media, and tenant isolation.
- A named maintenance/cutover owner, rollback owner, incident channel, and change ticket exist.

Commands:

```bash
npm run migration:runbook -- --stage=0 --json
npm run validate:migration
npm run db:migrate:verify
npm run test:integration:staging
```

The stage-0 command validates configuration but does not prove network reachability unless the operator runs the configured health checks. Record PostgreSQL, R2, Firestore, Storage, archive, and staging health results in the stage report.

Rollback/stop: stop before Stage 1; remove only temporary migration credentials and staging resources. Do not alter production authority.

## Stage 1 — Source snapshot

Record, with one migration timestamp and source project/database identifiers:

- Firestore document counts by collection and relevant subcollection.
- Firebase Storage object counts by bucket, prefix, purpose, and variant.
- Source timestamps, export job IDs, archive URI, archive manifest, and checksums.

Create an immutable Firestore export/archive and verify that the archive is readable, complete, retained, and protected from mutation. Persist the archive checksum and metadata in the migration report and controlled evidence store.

Commands:

```bash
# Provider-specific export is executed by the migration owner using read-only source credentials.
npm run verify:firestore-archive
npm run migration:runbook -- --stage=1 --json
```

Rollback/stop: if counts, archive readability, checksum, or retention is uncertain, stop and create a new snapshot. Never proceed using an unverifiable archive.

## Stage 2 — Initial migration

Migrate in bounded, resumable domains while preserving stable IDs and writing legacy-ID mappings where normalization changes shape:

1. Firestore sites, accounts/application profiles, drafts, snapshots, audience, bookings, products, orders, payments, subscriptions, domains, integrations, analytics rollups, jobs, outbox, audit data, and feature flags.
2. Firebase Storage originals, thumbnails, optimized variants, avatars, galleries, and product media to stable R2 object keys.

Every operation must be idempotent, checkpointed, ownership-scoped, and report counts, skipped records, conflicts, missing mappings, invalid ownership, and failures. Do not delete or mutate source records.

Plan and execution commands:

```bash
npm run migration:runbook -- --stage=2 --json
npm run migrate:firestore-postgres -- --dry-run
MEDIA_MIGRATION_DRY_RUN=true npm run migrate:media
```

After review, run each approved bounded migration command with live credentials and an explicit report path. The orchestrator does not grant authority or perform destructive cleanup.

Rollback: stop the affected domain, retain source and target data, replay the idempotent migration after correcting mappings, or restore PostgreSQL from the pre-migration backup if target corruption is proven. Do not delete partially migrated target rows without a reviewed domain-specific cleanup plan.

## Stage 3 — Reconciliation

Run read-only reconciliation for:

- record counts and stable-ID mappings;
- tenant/site ownership and cross-tenant isolation;
- site, draft, published snapshot, block, SEO, and domain relationships;
- booking services, slots, attendees, and booking relationships;
- products, variants, inventory, reservations, orders, payments, fulfillment, and subscriptions;
- integration provider metadata without comparing secrets in plaintext;
- media object counts, checksums/bytes, metadata, ownership, variants, and CDN URLs;
- published snapshot versions and public payload parity.

Classify every difference as:

- `expected`: documented normalization or intentionally excluded legacy record;
- `warning`: non-critical discrepancy requiring owner and follow-up;
- `blocking`: count/ownership/reference/semantic/media/public-rendering mismatch, orphan, duplicate, missing object, or unauthorized access risk.

Commands:

```bash
npm run reconcile:firestore-postgres
npm run reconcile:media-r2
npm run verify:firestore-archive
npm run migration:runbook -- --stage=3 --json
```

Set `FIRESTORE_RECONCILIATION_STATUS=passed`, `MEDIA_R2_RECONCILIATION_STATUS=passed`, `CRITICAL_MISMATCH_COUNT=0`, and `MIGRATION_COMPLETION_STATUS=passed` only from generated reports, not manually before review.

The runbook requires `RECONCILIATION_ARTIFACT_FILE` to be readable JSON with `status: "passed"` and zero critical mismatches. Its SHA-256 must match `RECONCILIATION_ARTIFACT_SHA256` when supplied and the `reconciliationReportSha256` value inside the signed approval artifact. This prevents a flag or stale report from authorizing cutover.

Rollback/stop: any blocking difference blocks cutover. Correct and rerun the bounded migration, or leave the legacy system authoritative.

## Stage 4 — Application equivalence

Run against isolated staging and PostgreSQL/R2:

- Studio load/save, autosave, optimistic concurrency, multi-site, and reload;
- publishing, rollback/unpublish, public profile, metadata, and published-only rendering;
- audience, forms, exports, counts, and tenant isolation;
- booking creation, cancellation, concurrency protection, notifications, and calendar jobs;
- products, pricing, checkout, Stripe test webhook, orders, inventory, fulfillment, and refunds where supported;
- media upload, processing, thumbnails, avatars, galleries, products, deletion, CDN URLs, and orphan cleanup;
- domains, DNS/SSL state, integrations, OAuth refresh, analytics ingestion/rollups, and worker retries.

Commands:

```bash
npm run test:all
npm run test:booking-concurrency
npm run test:commerce-concurrency
npm run test:integration:staging
npm run migration:runbook -- --stage=4 --json
```

Rollback/stop: fail the equivalence gate and keep legacy authority. Do not enable mixed authoritative writes without an explicit reviewed recovery plan.

## Stage 5 — Authority cutover

Only after Stages 0–4 pass, `FIRESTORE_AUTHORITY_CUTOVER_APPROVED=true`, and signed authority approval exists:

1. Take a final source timestamp and backup marker.
2. Switch application reads and writes to PostgreSQL.
3. Switch media reads and writes to R2.
4. Disable Firestore and Firebase Storage fallback readers/writers.
5. Keep legacy data read-only and retain all migration reports.
6. Deploy with controlled configuration; browser/UI flags cannot authorize this operation.

Gate and command:

```bash
npm run migration:runbook -- --stage=5 --json
# Then perform the reviewed deployment through the release system.
```

The stage-5 gate validates reconciliation status, archive verification, zero critical mismatches, migration completion, archive URI, the verified reconciliation artifact, the technical flag, and a signed `authority-cutover` approval. It does not itself change traffic.

Rollback criteria: elevated 5xx/database errors, authorization failures, missing media, booking conflicts, payment/webhook failures, semantic mismatches, outbox/job failures, or any cross-tenant access anomaly. Rollback command:

```bash
npm run deploy:rollback
# restore the previous controlled repository/provider selection through deployment configuration
```

Do not delete PostgreSQL/R2 data during rollback. Reconcile again before retrying.

## Stage 6 — Observation window

Keep Firestore and Firebase Storage available but read-only. Observe for the agreed window, normally at least one complete business cycle and any booking/payment settlement window.

Monitor and alert on:

- HTTP 5xx and latency;
- PostgreSQL errors, locks, pool saturation, and transaction failures;
- data mismatches and missing media;
- booking conflicts/failures and calendar jobs;
- Stripe/payment/webhook failures and order state divergence;
- authorization, tenant-isolation, and OAuth failures;
- Cloud Tasks backlog, retries, dead letters, and worker failures.

Run repeated read-only reconciliation and retain dashboards/reports. Set `OBSERVATION_WINDOW_STATUS=passed` only after the named owner signs the observation report.

Rollback: use the Stage 5 rollback if any blocking alert occurs; preserve evidence and stop decommission planning.

## Stage 7 — Decommission approval

Require explicit human approval after the observation window and set `FIRESTORE_DECOMMISSION_APPROVED=true` through the controlled deployment configuration. Approval must identify operator, change ticket, scope, timestamp, expiry, archive URI, reconciliation report hash, and a cryptographic signature. It must be a separate `legacy-decommission` approval, not the authority-cutover approval. The boolean alone is never sufficient.

```bash
npm run migration:runbook -- --stage=7 --json
```

Rollback/stop: if approval is absent, expired, unsigned, mismatched, or evidence is stale, do not proceed.

## Stage 8 — Decommission

After the signed approval and all gates pass:

- remove Firestore runtime repositories, fallback readers, job/outbox/authorization lookups, and Firestore configuration;
- remove Firebase Storage runtime adapters, uploads, signed URLs, cleanup, rules, and configuration;
- remove obsolete compatibility flags and deployment variables;
- archive migration/reconciliation tools outside the runtime package if retention is required;
- update deployment manifests and environment validation;
- rerun full lint, typecheck, build, migrations, unit/domain/HTTP/contract/integration/E2E/staging smoke and release certification.

The executable gate is:

```bash
npm run migration:runbook -- --stage=8 --json
npm run check:firestore-decommission
npm run check:media-r2-decommission
```

The runbook never invokes deletion automatically. The decommission gate requires reconciliation, archive verification, a passed observation window, and a signed `legacy-decommission` approval. If any check fails, source systems remain intact.

Rollback: restore the last certified application revision and deployment configuration, stop cleanup jobs, preserve archives and reports, and do not attempt to recreate deleted source data without a tested archive restore procedure.

## Final completion record

The migration is complete only when the release record contains all stage reports, archive URI/checksum, reconciliation reports, equivalence results, approval artifacts, rollback test result, deployment revision, and final decommission certification. “No errors observed” is not a substitute for machine-readable evidence or approval.
