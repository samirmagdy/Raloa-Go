# Firestore decommission readiness

Status: **blocked — do not remove Firestore yet**

The requested decommission sequence is not currently safe. The baseline still identifies Firestore as an active operational dependency, and the source scan found direct production-path reads/writes. Firebase Auth is intentionally retained and is not a decommission target.

## Current evidence

The following production paths still depend on Firestore:

| Area | Current evidence | Required before removal |
| --- | --- | --- |
| Server bootstrap | `server-services.ts` initializes `getFirestore`; `server.ts` composes Firestore repositories | Replace all non-auth Firestore composition with PostgreSQL/adapters |
| Sites/publication | `SITES_POSTGRES_AUTHORITATIVE` defaults off; profile loaders still read `users` from Firestore | Migrate accounts/profile ownership and prove public/draft parity |
| Authorization/entitlements | account/site ownership resolution reads Firestore `users` and `sites` | PostgreSQL account/workspace/role/entitlement authority |
| Billing/subscriptions | Firestore billing repository, users, webhook and reconciliation collections remain active | Reconcile every billing/customer/subscription/payment record in PostgreSQL |
| Bookings/calendar | Firestore booking repository, booking locks, notification jobs and calendar jobs remain in compatibility paths | Prove PostgreSQL concurrency and worker reconciliation for all tenants |
| Commerce | Legacy products/orders/inventory/payment paths remain in `server.ts` | Reconcile product, variant, reservation, payment, fulfillment, and state history data |
| Audience/analytics | Firestore rollups, subscribers/submissions and telemetry compatibility paths remain | Reconcile bounded rollups and analytical raw-event export |
| Media | Firestore `media_assets` metadata and Firebase Storage compatibility remain | Verify PostgreSQL metadata/R2 object counts, checksums, lifecycle states, and URLs |
| Domains/integrations | Firestore custom-domain, OAuth, calendar and provider state remain | Reconcile ownership, encrypted connections, state, and external IDs |
| Jobs/outbox/audit | Firestore background jobs, outbox, audit, idempotency and rate-limit state remain | Drain/replay/reconcile all records before archive |
| Feature flags | `createFirestoreFeatureFlagRepository` is still the active source | Move flags to PostgreSQL or another explicitly approved control plane |
| Browser client | `src/lib/firebase.ts` still imports `firebase/firestore` and exposes `db`/Firestore helpers | Remove browser Firestore reads/writes while keeping Firebase Auth and Storage only where needed |

The complete source scan currently reports direct Firestore-specific references across `server.ts`, `server-services.ts`, Firestore repositories/workers, migration infrastructure, client Firebase code, Firebase config/rules, tests, and documentation. This is expected evidence of an incomplete migration, not a removal checklist.

## Migration/reconciliation gate

The existing migration tooling covers only bounded portions of the target state (`sites`, `audience`, booking schedules/bookings, commerce, and media). There is no completed, verified reconciliation report proving that all production collections—including users/accounts, billing, subscriptions, domains, integrations, jobs, outbox, audit, feature flags, idempotency, sessions, rate limits, and analytics history—are equivalent in PostgreSQL.

Do not archive or delete Firestore until every domain has:

1. A final read-only export with collection/document counts, checksums, timestamps, and an immutable archive URI.
2. A PostgreSQL reconciliation report with zero unexplained missing, duplicate, ownership, status, or referential-integrity mismatches.
3. A completed observation window with PostgreSQL-only reads/writes and no Firestore fallback logs.
4. A production regression run covering API, provider, worker, browser, billing, booking, commerce, media, domains, and public rendering flows.
5. A rollback decision that no longer requires Firestore data; the archive must be recoverable without reconnecting Firestore to live traffic.

## Cleanup gate

`npm run check:firestore-decommission` intentionally fails until all source references are removed, reconciliation is marked passed, an archive URI is supplied, and an explicit approval flag is set. It does not delete data or modify Firebase Auth.

The eventual cleanup must be a separate forward-only change:

1. Freeze writes and run final reconciliation.
2. Export/archive Firestore and verify restore/listability.
3. Deploy the PostgreSQL-only application and run the full regression suite.
4. Remove Firestore repositories, provider imports, rules/indexes, config, and dependencies in a reviewed change.
5. Retain Firebase Auth (`firebase/auth`, `firebase-admin/auth`) and any intentionally retained Firebase Storage adapter until its own migration is complete.
6. Keep the archive and decommission evidence for the retention period; only then delete the Firestore database/project resources through an approved operations runbook.
