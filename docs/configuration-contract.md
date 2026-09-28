# Raloa production configuration contract

This is the authoritative configuration contract for the target architecture. It contains placeholders only. Secret values belong in Google Secret Manager (or an equivalent managed secret store), never in source control or `NEXT_PUBLIC_*` variables.

Target runtime: Next.js web/API, PostgreSQL, Firebase Auth, Cloudflare R2 and domain APIs, Stripe, Cloud Tasks workers, and Sentry. Firebase Firestore and Firebase Storage variables are migration-only and must not be loaded by the target application runtime.

## Configuration modes

| Scope | Meaning | Examples |
| --- | --- | --- |
| Runtime-required | Required by every target API process | `NODE_ENV`, `APP_ENV`, `APP_URL`, `RELEASE_ID`, `TRUSTED_PROXY_HOPS` |
| Server-only | Never sent to browser bundles | database URLs, R2 keys, Stripe keys, Cloudflare token, KMS, OAuth secrets |
| Worker-only | Required by background workers | email credentials; Cloud Tasks identity is required by API and workers |
| Browser-safe | Public Firebase Auth/client and public URLs only | `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_APP_URL` |
| Build-time | Needed to build or upload source maps | Sentry org/project/auth token; do not expose auth token to the browser |
| Migration-only | Used by explicit migration/reconciliation commands | Firestore source, storage source, archive URI, batch settings |
| Staging-only | Isolated resources and Stripe test mode | `STAGING_RESOURCE_PREFIX`, `STAGING_STRIPE_MODE=test` |
| Production-only | Live resources, managed secrets, and production approval | `APP_ENV=production`, Secret Manager references, live Stripe keys |

## Required target variables

The strict validator is `scripts/validate-target-production-env.mjs`. It validates shape and presence only; it does not contact providers. Set `POSTGRES_APPLICATION_DATASTORE_ONLY=true` to activate the target startup gate in the application.

### API/server

`NODE_ENV=production`, `APP_ENV=staging|production`, `APP_URL`, `RELEASE_ID`, `TRUSTED_PROXY_HOPS`, `POSTGRES_ENABLED=true`, `POSTGRES_DATABASE_URL`, `POSTGRES_SSL=true`, `POSTGRES_POOL_MAX`, `POSTGRES_POOL_MIN`, `POSTGRES_CONNECTION_TIMEOUT_MS`, `POSTGRES_IDLE_TIMEOUT_MS`, `FIREBASE_PROJECT_ID`, `FIREBASE_ADMIN_ENABLED=true`, `FIREBASE_ADMIN_CREDENTIAL_MODE=workload_identity` (or an explicitly mounted credential file), the R2 settings, Cloudflare API token plus zone/account identifier, Stripe secret/webhook/price IDs, Cloud Tasks project/location/queue/worker URL, Sentry DSN/environment/release, KMS key resource, and session secret.

Cloud Tasks must use either `CLOUD_TASKS_SERVICE_ACCOUNT` with OIDC/workload identity or the controlled internal `CLOUD_TASKS_AUTH_TOKEN` mechanism. Prefer the service-account path.

### Worker

Workers require all API/server settings plus `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. Calendar OAuth variables are required only when `ENABLE_GOOGLE_CALENDAR=true` or `ENABLE_MICROSOFT_CALENDAR=true`.

### Browser-safe Firebase Auth

`NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, and `NEXT_PUBLIC_FIREBASE_APP_ID` are client configuration, not credentials. Firebase Admin credentials, OAuth secrets, database URLs, provider tokens, KMS credentials, and email keys must never use `NEXT_PUBLIC_*`.

## Secret Manager mapping

| Secret Manager secret | Runtime variable | Consumer |
| --- | --- | --- |
| `raloa-postgres-database-url` | `POSTGRES_DATABASE_URL` | API, web server, workers |
| `raloa-auth-session-secret` | `AUTH_SESSION_SECRET` | API/web server |
| `raloa-stripe-secret-key` | `STRIPE_SECRET_KEY` | API/workers |
| `raloa-stripe-webhook-secret` | `STRIPE_WEBHOOK_SECRET` | API |
| `raloa-cloudflare-api-token` | `CLOUDFLARE_API_TOKEN` | domain service/workers |
| `raloa-r2-access-key-id` | `CLOUDFLARE_R2_ACCESS_KEY_ID` | media service/workers |
| `raloa-r2-secret-access-key` | `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | media service/workers |
| `raloa-google-calendar-client-secret` | `GOOGLE_CALENDAR_CLIENT_SECRET` | integration workers |
| `raloa-microsoft-calendar-client-secret` | `MICROSOFT_CALENDAR_CLIENT_SECRET` | integration workers |
| `raloa-email-api-key` | `RESEND_API_KEY` | email worker |
| `raloa-sentry-auth-token` | `SENTRY_AUTH_TOKEN` | build/deploy only |

Use workload identity for Firebase Admin, Cloud Tasks dispatch/OIDC, Secret Manager, KMS, and Cloud Storage archive access where supported. Do not create long-lived service-account key files for production.

## Deployment mapping

| Component | Configuration source | Required isolation |
| --- | --- | --- |
| Next.js web/API | Cloud Run/hosting environment plus Secret Manager bindings | production/staging service and database |
| Workers | Cloud Run worker service plus Cloud Tasks OIDC identity | separate service account and queue |
| Cloud Tasks | queue configuration and worker URL | staging queue must target staging worker only |
| PostgreSQL | managed instance/connection pool | separate staging database; migrations use controlled migration identity |
| R2 | bucket/account/CDN config and managed access keys | staging bucket prefix/bucket separate from production |
| Stripe | test/live key and endpoint secret | never mix test and live webhooks |
| Sentry | DSN/env/release | staging and production projects/environments are distinct |

## Migration-only variables

These variables are consumed only by migration/reconciliation/archive commands and are not valid application runtime dependencies: `FIRESTORE_SOURCE_PROJECT_ID`, `FIRESTORE_SOURCE_DATABASE_ID`, `FIREBASE_STORAGE_SOURCE_BUCKET`, `FIRESTORE_ARCHIVE_URI`, `FIRESTORE_ARCHIVE_MANIFEST`, `FIRESTORE_RECONCILIATION_REPORT`, `MEDIA_SOURCE_MANIFEST`, `MEDIA_TARGET_MANIFEST`, `MIGRATION_BATCH_SIZE`, `MIGRATION_DRY_RUN`, and (where a separate least-privilege migration connection is used) `POSTGRES_MIGRATION_DATABASE_URL`.

Run `npm run validate:migration -- ...` only in a migration environment. A valid shape is not evidence that an archive exists or that reconciliation passed.

## Migration command map

| Purpose | Command | Safe default |
| --- | --- | --- |
| Firestore → PostgreSQL execution plan | `npm run migrate:firestore-postgres -- --dry-run` | reports reads/writes; no deletes or cutover |
| Firestore/PostgreSQL reconciliation | `npm run reconcile:firestore-postgres` | read-only; exits nonzero on mismatches |
| Firebase Storage → R2 migration | `MEDIA_MIGRATION_DRY_RUN=true npm run migrate:media` | requires explicit provider configuration before any live run |
| Storage reconciliation | `npm run reconcile:media-r2` | manifest-only read and comparison |
| Firestore archive verification | `npm run verify:firestore-archive` | local manifest verification; no archive approval |

Migration commands must be run with `npm run validate:migration` first. Dry-run output must be reviewed for intended reads, writes, deletions, record counts, conflicts, missing mappings, ownership failures, and unresolved issues. No command in this contract grants authority to switch production reads or delete a legacy system.

## Checklists

### Staging

- [ ] `NODE_ENV=production`, `APP_ENV=staging`, `SECRET_MANAGER_ENABLED=true`.
- [ ] Staging PostgreSQL, R2 bucket, Cloud Tasks queue, Stripe test mode, Sentry environment, and OAuth callbacks are isolated.
- [ ] Firebase Auth project and browser-safe config point to staging.
- [ ] Cloud Tasks OIDC audience resolves only to the staging worker.
- [ ] No production domain, bucket, database, Stripe live key, archive, or webhook endpoint is referenced.
- [ ] `npm run validate:target-production` and staging smoke tests pass.

### Production

- [ ] PostgreSQL authority and all migration/decommission gates have independently passed; no Firestore/Storage fallback is enabled.
- [ ] All secrets are Secret Manager bindings or workload identity; no raw secret is in deployment manifests.
- [ ] `POSTGRES_SSL=true`, pooling and timeouts are explicitly set.
- [ ] Live Stripe webhook secret and price mappings are verified.
- [ ] Cloudflare zone/account, R2 CDN, Cloud Tasks worker identity, OAuth callbacks, email sender, KMS, and Sentry release are verified.
- [ ] Backup/PITR, alerting, rollback, and operator approval procedures are confirmed.
- [ ] `npm run validate:target-production` passes before deployment.

## Fail-fast and authority rules

Target startup fails when critical configuration is missing or malformed. Provider availability is not inferred from absent data, and PostgreSQL unavailability must surface as a service failure rather than trigger a Firestore read. The target validator does not grant authority to cut over or decommission legacy systems; those remain explicit evidence- and approval-gated operations.
