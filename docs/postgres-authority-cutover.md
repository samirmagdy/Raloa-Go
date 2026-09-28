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

## File-by-file removal plan

| File | Classification | Removal condition |
| --- | --- | --- |
| `server-services.ts` | production read/write; authorization; feature flags | Replace all exported application loaders with PostgreSQL services; retain Firebase Auth only |
| `server.ts` | production read/write; authorization; worker dependency | Move every handler to PostgreSQL services/controllers, then remove Firestore imports and direct calls |
| `server/adapters/firebase.ts` | production compatibility adapter | Remove after no module imports it |
| `server/audit/firestore.ts` | production write | Wire PostgreSQL audit repository and verify append-only audit parity |
| `server/background-jobs/firestore-repository.ts` | background-job dependency | Wire PostgreSQL `operational_jobs` and Cloud Tasks only |
| `server/core/ownership.ts` | authorization dependency | Resolve account/site membership from PostgreSQL |
| `server/core/types.ts` | authorization/framework type dependency | Replace Firestore snapshot types with domain records |
| `server/domains/analytics/index.ts` | production read/write | Use PostgreSQL rollups and analytical raw-event abstraction |
| `server/domains/audience/index.ts` | production read/write | Use PostgreSQL audience repository with cursor pagination |
| `server/domains/bookings/index.ts` | production read/write | Use PostgreSQL schedule/booking repositories and transaction boundaries |
| `server/domains/bookings/migration.ts` | migration-only | Archive with migration tooling after reconciliation |
| `server/domains/bookings/calendar-sync-worker.ts` | background-job dependency | Use PostgreSQL booking, OAuth, calendar state, and job repositories |
| `server/domains/domains/index.ts` | production read/write | Use PostgreSQL domain service only |
| `server/domains/domains/verification-worker.ts` | background-job dependency | Use PostgreSQL domain state and Cloudflare adapter |
| `server/domains/integrations/index.ts` | production read/write | Use encrypted PostgreSQL OAuth/integration repositories |
| `server/domains/inventory/index.ts` | production read/write | Use transactional PostgreSQL inventory service |
| `server/domains/media/index.ts` | production read/write | Use PostgreSQL media metadata and R2 service |
| `server/domains/notifications/email-worker.ts` | background-job dependency | Use PostgreSQL jobs/bookings and email adapter |
| `server/domains/orders/index.ts` | production read/write | Use PostgreSQL order state machine and payment records |
| `server/domains/products/index.ts` | production read/write | Use PostgreSQL product/variant repositories |
| `server/domains/sites/index.ts` | production read/write | Use PostgreSQL sites/drafts/published snapshots |
| `server/domains/subscriptions/index.ts` | production read/write | Use PostgreSQL subscriptions/billing state |
| `server/infrastructure/feature-flags/firestore.ts` | feature-flag dependency | Implement and wire PostgreSQL feature flag repository |
| `server/infrastructure/firestore-oauth-repository.ts` | production compatibility | Remove after OAuth repository cutover and token reconciliation |
| `server/infrastructure/firestore-repository.ts` | production compatibility | Remove after generic repository consumers are migrated |
| `server/infrastructure/migrations/firestore-checkpoint-store.ts` | migration-only | Move to archive/tooling package after migration completion |
| `server/modules.ts` | production composition | Change module factory contracts from Firestore to repository interfaces |
| `server/outbox/firestore.ts` | production write/background dependency | Wire PostgreSQL transactional outbox and Cloud Tasks |
| `server/repositories/firestore.ts` | production fallback and migration source | Retain outside runtime until all domain reconciliation passes, then archive |
| `server/repositories/site-persistence.ts` | production fallback | Remove Firestore site implementation after PostgreSQL site/profile parity |
| `src/lib/firebase.ts` | Firebase Auth plus production Firestore client | Split Auth into an Auth-only module, remove Firestore imports, then preserve Auth module |

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

The decommission gate remains separate and still requires an archive URI. A boolean is not sufficient approval: the gate also verifies a signed, time-bounded approval artifact containing the change ticket, operator, archive URI, and reconciliation report reference. Firebase Auth configuration is excluded from all Firestore cleanup checks.
