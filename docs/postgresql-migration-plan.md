# PostgreSQL migration plan

`db/migrations/001_postgres_target_schema.sql` is the target transactional schema. It is additive
and does not run against the current Firebase project.

## Boundaries

- Firebase Auth remains authoritative for identity during migration; `app_users.external_auth_id`
  maps Firebase UIDs to local UUIDs.
- Services depend on repository ports, not SQL or Firestore document shapes.
- External provider identifiers remain in provider columns, while provider credentials remain
  encrypted and outside API response models.
- Analytics events and rollups are separate from transactional tables so reporting cannot extend
  booking/order transactions.

## Transaction boundaries

1. Booking creation: resolve site/service, lock the requested time range through the exclusion
   constraint, insert the booking, and enqueue calendar/notification jobs in one transaction.
2. Order checkout: claim the idempotency key, lock inventory rows with `FOR UPDATE`, validate
   available stock, insert the order/items/reservation, and commit before calling Stripe. Provider
   confirmation is a separate webhook transaction.
3. Payment webhook: lock the idempotency key and subscription/order row, apply the provider event,
   update subscription/order state, release or consume inventory, and enqueue notifications in one
   transaction.
4. Subscription changes: upsert by `(user_id, provider)`, with provider event IDs recorded in the
   idempotency table before applying state changes.
5. Analytics ingestion: append the event independently; rollups are updated asynchronously with
   `INSERT ... ON CONFLICT DO UPDATE`.
6. Job workers: claim work with `FOR UPDATE SKIP LOCKED`, increment attempts, perform the external
   call outside the database lock, then commit success/retry state.

## Staged rollout

1. Apply the schema and create the Firebase UID mapping; do not change reads.
2. Backfill users, sites, products, orders, bookings, subscriptions, integrations, domains, and
   analytics in dependency order. Record source document IDs for reconciliation.
3. Add shadow writes from repository adapters and compare normalized read models against Firestore.
4. Enable PostgreSQL reads per domain behind a feature flag, with Firestore fallback only for
   unreconciled records.
5. Move writes to PostgreSQL after reconciliation and retain Firestore dual-write temporarily.
6. Remove dual-write only after webhook replay, idempotency replay, inventory, booking overlap,
   and audit checks pass for the agreed observation window.

Rollback is a feature-flag change while dual-write remains enabled; no destructive Firestore
operation is part of this migration.
