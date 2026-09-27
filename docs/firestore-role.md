# Firestore role reduction

Firestore is no longer the default datastore for the product. Its long-term role is limited to
workloads where document storage or realtime delivery is a material product capability. New
relational or transactional domains default to PostgreSQL.

## Retained Firestore exceptions

Firestore may remain authoritative for:

- Studio editor configuration and draft/autosave documents, where the document shape and realtime
  preview materially improve the editing experience.
- Realtime collaboration state such as presence, cursors, and other ephemeral collaborative signals.

These exceptions still use repository/service boundaries. Firestore collection paths must not leak
into controllers, public API contracts, or shared domain services. Editor configuration is
normalized through the shared schema package before it is consumed by Studio preview or public
rendering.

Firestore is not the authority for payments, subscriptions, orders, inventory, bookings,
fulfillment, domain ownership, integrations, or other state that requires relational constraints,
auditable history, or multi-row transactions.

## PostgreSQL default

Sites, bookings, products, inventory, orders, subscriptions, integrations, domains, analytics,
media metadata, background jobs, and outbox state are PostgreSQL-owned in the target architecture.
The reasons are documented in the machine-readable storage policy.

The authoritative assignments are maintained in
[`server/infrastructure/persistence/storage-policy.ts`](../server/infrastructure/persistence/storage-policy.ts)
and checked by `npm run test:storage-policy`.

## Migration rules

Existing Firestore repositories for PostgreSQL-owned domains are compatibility adapters only. They
may support backfill, shadow writes, dual reads, and rollback during the migration window, but they
must not become the long-term reason to add new business logic to Firestore.

The migration ends when PostgreSQL is the write authority, reconciliation checks pass, and the
Firestore adapter is removed or explicitly marked read-only. New features must not extend a
migration-only Firestore collection without an approved exception recorded in the storage policy.

Firestore and PostgreSQL are not dual authorities. Cross-store synchronization uses versioned
events, an outbox, idempotency keys, and reconciliation jobs; it does not rely on distributed
transactions.
