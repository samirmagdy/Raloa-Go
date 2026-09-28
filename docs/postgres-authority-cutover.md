# PostgreSQL authority cutover inventory

Status: **blocked — PostgreSQL is not yet the single application datastore**

Firebase Auth remains intentionally retained. Firestore is not yet Auth-only: it remains in application composition, authorization, feature flags, background jobs, outbox, audit, domains, media, analytics, billing, and legacy route handlers.

## Active Firestore inventory

| Area / file | Collections or calls | Classification | PostgreSQL replacement/status |
| --- | --- | --- | --- |
| `server-services.ts` | `users`, `custom_domains`, `users/{uid}/sites`, `collectionGroup('sites')`, billing state, `billing_reconciliation_runs` | production read/write and composition | Partial repositories exist; account/profile, billing, domain, and public resolution are still Firestore-backed |
| `server.ts` composition root | Firestore billing/site/booking repositories, feature flags, audit, jobs, outbox, email, calendar, domain workers | production dependency | PostgreSQL implementations are not all wired; legacy handlers remain active |
| `server.ts` route handlers | `users`, `sites`, handles, bookings/locks, audience/forms, analytics events/rollups, sessions, products/orders/payments, domains, integrations, media metadata, rate limits | production read/write | Many handlers directly call `adminDb`; this is the primary cutover blocker |
| `server/repositories/firestore.ts` | sites, bookings, orders, products, payments, fulfillments, inventory, subscriptions, integrations, audience, analytics, billing, domains, media | production compatibility and migration fallback | PostgreSQL equivalents exist for several domains but are not universal or authoritative |
| `server/repositories/site-persistence.ts` | users, nested sites, slug redirects | production fallback | PostgreSQL site repository exists; profile/redirect authority remains incomplete |
| `server/infrastructure/firestore-repository.ts` | generic nested owned collections | repository compatibility | No direct PostgreSQL replacement; must be removed from runtime composition |
| `server/infrastructure/firestore-oauth-repository.ts` | `oauth_connections` | production compatibility | PostgreSQL OAuth repository exists; runtime selection still allows Firestore |
| `server/audit/firestore.ts` | `audit_log` | production write | PostgreSQL audit repository is not wired as the sole implementation |
| `server/background-jobs/firestore-repository.ts` | `background_jobs` | worker dependency | PostgreSQL `operational_jobs` exists; Cloud Tasks runtime still selects Firestore repository |
| `server/outbox/firestore.ts` | `outbox_events` | production write/worker dependency | PostgreSQL outbox repository exists; Firestore outbox remains exported and composed |
| `server/infrastructure/feature-flags/firestore.ts` | `feature_flags` | production read/write | PostgreSQL `feature_flags` table exists, but no authoritative PostgreSQL repository is wired |
| `server/domains/*/index.ts` | sites, bookings, orders, products, inventory, subscriptions, integrations, audience, analytics, domains, media | production module dependency | Domain factories still accept Firestore and instantiate Firestore repositories |
| `server/domains/bookings/calendar-sync-worker.ts` | `calendar_jobs`, `bookings`, `calendar_integrations` | worker dependency | Must use `calendar_sync_state`, integrations, and jobs through PostgreSQL repositories |
| `server/domains/notifications/email-worker.ts` | `notification_jobs`, `bookings` | worker dependency | Must use PostgreSQL jobs/bookings and provider adapter |
| `server/domains/domains/verification-worker.ts` | `custom_domains` | worker dependency | PostgreSQL domain service exists; worker still reads Firestore |
| `server/core/ownership.ts`, `server/core/types.ts` | Firestore document types/snapshots | authorization dependency | Must resolve account/site membership from PostgreSQL |
| `server/modules.ts` | Firestore module composition | production composition | Must accept PostgreSQL repositories only |
| `server/adapters/firebase.ts` | generic Firestore adapter | compatibility | Obsolete after migration, but still referenced by active modules |
| `src/lib/firebase.ts` | browser Firestore and Firebase Storage | client production dependency | Firebase Auth must remain; Firestore and Storage imports must be removed separately |
| `scripts/migrate-*.ts`, `scripts/verify-bookings.ts` | Firestore source reads/checkpoints | migration tooling | Retain until final archive/reconciliation, never import from production runtime |
| `scripts/staging-integration-checks.mjs` | Firestore staging fixtures | test/staging dependency | Replace with PostgreSQL/R2 fixtures after migration validation |
| `scripts/cleanup-deleted-accounts.ts` | users/sites/referrals/sessions | operational worker dependency | Needs PostgreSQL account/site/session implementation |

## Classification summary

- **Production reads/writes:** `server.ts`, `server-services.ts`, Firestore repositories, authorization/account resolution, billing, domains, media, audience, analytics, jobs, outbox, audit, feature flags, calendar/email workers.
- **Migration fallback:** site persistence, booking migration repository, Firestore migration sources, legacy IDs/checkpoints.
- **Worker dependency:** Firestore background jobs, calendar jobs, notification jobs, domain verification, outbox publishing/cleanup.
- **Test/staging-only:** staging fixture checks and migration verification scripts, although they still require Firestore credentials.
- **Obsolete:** none can be safely classified obsolete until the production/source references are removed and reconciliation passes.

## Required PostgreSQL-only runtime wiring

The production composition root must be changed from feature-flag selection to a required PostgreSQL graph:

```text
Firebase token -> PostgreSQL app_user/account/membership
                  -> PostgreSQL repositories/services
                  -> PostgreSQL outbox/operational_jobs
                  -> Cloud Tasks workers
                  -> provider adapters
```

If PostgreSQL cannot connect, the service must fail readiness and authenticated/application operations must return a dependency failure. It must not call Firestore as fallback. Firebase Auth token verification may still run because identity remains external to PostgreSQL.

## Cutover gate

Run the reconciliation command before changing authority:

```bash
npm run reconcile:firestore-postgres
```

The cutover is blocked unless the report has zero row-count, ownership, referential-integrity, and semantic mismatches for every domain. After the observation window, set the explicit approval variables and run:

```bash
FIRESTORE_RECONCILIATION_STATUS=passed \
FIRESTORE_AUTHORITY_CUTOVER_APPROVED=true \
npm run check:firestore-authority
```

The decommission gate remains separate and still requires an archive URI. Firebase Auth configuration is excluded from all Firestore cleanup checks.

