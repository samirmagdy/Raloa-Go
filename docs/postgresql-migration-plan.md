# PostgreSQL migration plan

`db/migrations/001_postgres_target_schema.sql` is the target transactional schema. It is additive
and does not run against the current Firebase project.

## Boundaries

- Firebase Auth remains authoritative for identity during migration; `app_users.external_auth_id`
  maps Firebase UIDs to local UUIDs.
- Firestore is retained long term only for editor configuration and realtime collaboration. New
  relational domains default to PostgreSQL; existing Firestore repositories for those domains are
  migration adapters, not a permanent second authority. See
  [`docs/firestore-role.md`](firestore-role.md).
- Custom-domain ownership, verification, certificate state, DNS instructions, and routing metadata
  are relational domain state; Cloudflare remains an adapter behind a retryable provisioning service.
- Services depend on repository ports, not SQL or Firestore document shapes.
- External provider identifiers remain in provider columns, while provider credentials remain
  encrypted and outside API response models.
- Analytics events and rollups are separate from transactional tables so reporting cannot extend
  booking/order transactions. PostgreSQL owns bounded Studio rollups; high-volume raw event history
  belongs in BigQuery or an equivalent analytical store. See
  [`docs/analytics-architecture.md`](analytics-architecture.md).
- Inventory is variant-scoped: `inventory` is the current stock snapshot, while
  `inventory_movements` is the append-only audit ledger and `inventory_reservations` tracks holds.
- Stripe billing is an event source, not the application read model: `billing_customers`,
  `billing_price_mappings`, `subscriptions`, and `subscription_state_history` hold normalized
  internal billing state.

## Transaction boundaries

The normative consistency contract, including external-provider boundaries and worker retry rules,
is documented in [`docs/transaction-strategy.md`](transaction-strategy.md). The domain-specific
boundaries below describe the PostgreSQL implementation details.

1. Booking creation: claim `(site_id, idempotency_key)`, lock the requested `booking_slots` row
   with `FOR UPDATE`, verify `status`, `booked_count`, and the service/site relationship, insert
   the booking and attendees, update the slot counters, and enqueue calendar/notification jobs in
   one transaction. The unique active-slot index and the `tstzrange` exclusion constraint protect
   against races and overlapping legacy/non-slot bookings.
2. Order checkout: claim the idempotency key, lock inventory rows with `FOR UPDATE`, validate
   available stock, insert the order/items/reservation and a `reservation` movement, and commit
   before calling Stripe. Provider confirmation is a separate webhook transaction that is
   idempotent on `(provider, provider_event_id)`.
3. Payment webhook: lock the idempotency key and subscription/order row, apply the provider event,
   update subscription/order state, release or consume inventory, and enqueue notifications in one
   transaction.
4. Billing webhook: claim `(provider, provider_event_id)` in `billing_webhook_events`; if already
   processed, return the stored result. Otherwise upsert the customer/subscription snapshot,
   append subscription history, update entitlement state, and mark the event processed in one
   transaction.
5. Subscription changes: upsert by `(user_id, provider)`, with provider event IDs recorded in the
   idempotency table before applying state changes.
6. Analytics ingestion: append the event independently; rollups are updated asynchronously with
   `INSERT ... ON CONFLICT DO UPDATE`.
7. Job workers: claim work with `FOR UPDATE SKIP LOCKED`, increment attempts, perform the external
   call outside the database lock, then commit success/retry state.

## Inventory transaction rules

- Lock the `inventory` row for the variant with `SELECT ... FOR UPDATE` before checking
  `on_hand - reserved`. Never derive availability from an unlocked read.
- Create the order, order item, reservation, and corresponding append-only movement in the same
  transaction. The movement stores the post-change balances for reconciliation.
- Expiration workers lock active reservations whose `expires_at <= now()`, transition them to
  `expired`, decrement `reserved`, and append one `reservation_release` movement. The reservation
  idempotency key prevents duplicate releases.
- Payment webhooks insert or lock the `payments` row using the provider event uniqueness constraint.
  A paid event consumes the reservation and appends a `sale` movement; a failed/expired event
  releases it. Replayed events return the already-applied result.
- Fulfillment transitions are recorded separately from payment state. Returns append a `return`
  movement instead of rewriting prior stock history.
- `inventory_movements` rejects updates and deletes, making reconciliation derive from an immutable
  sequence of deltas plus the current snapshot.

`order_items.variant_id` and `inventory_reservations.variant_id` stay nullable only during the
Firestore backfill. Before PostgreSQL becomes the write authority, backfill a default variant for
legacy products and add `NOT NULL` constraints.

## Order state machine

The authoritative order lifecycle is stored in `orders.state`; payment state is stored separately
in `payments.status`. The allowed graph is:

```text
pending -> paid -> processing -> fulfilled -> refunded
   |         |          |             |
   v         v          v             v
payment_failed       cancelled      refunded
```

`payment_failed -> pending` supports a retry. The PostgreSQL trigger rejects every other state
change, while the application service validates the same graph before issuing the write and inserts
`order_state_history`. Client payloads may request fulfillment actions, but cannot set `state`,
`payments.status`, or webhook outcomes directly.

## Booking relational semantics

- `availability_rules` and `availability_exceptions` are the authoring model.
- `booking_slots` is the materialized, queryable availability model generated from those rules.
- `bookings` records the reservation and references one slot when generated availability is used.
- `booking_attendees` is one-to-many so host, customer, and additional attendees are not embedded
  in a booking document.
- `calendar_sync_state` is one-to-one with a booking and stores provider synchronization state,
  never provider credentials.
- `booking_idempotency_keys` makes repeated public booking requests return the original response.

After backfill, `bookings.slot_id` should be made `NOT NULL` for services that require generated
slots. Keep it nullable only for a compatibility period while historical Firestore bookings are
being reconciled.

## Staged rollout

This is a strangler migration, not a platform replacement. The existing Firestore repository is
wrapped as the source implementation and the PostgreSQL repository is introduced behind the same
domain contract. [`createStranglerRouter`](../server/infrastructure/migrations/strangler.ts)
provides the request-path routing seam; it preserves source responses during shadow comparison,
routes only flagged tenants to PostgreSQL, and supports idempotent dual writes before cutover.

Migration is controlled by the resumable runner in
[`server/infrastructure/migrations/runner.ts`](../server/infrastructure/migrations/runner.ts).
Run one bounded domain at a time; do not migrate all collections in a single operation.

1. Apply the schema and create the Firebase UID mapping; keep source reads and writes authoritative.
2. Create a domain checkpoint and backfill stable-ID pages with idempotent target upserts. Persist
   the cursor after each successful page so an interrupted run resumes safely.
3. Reconcile normalized source and target records. Stop on missing, mismatched, or extra records;
   retain a report and repair the source/target mapping before proceeding.
4. Enable shadow reads through the strangler router and compare source/target responses without changing the client response.
   Track mismatch counts and latency/errors during an observation window.
5. Enable the tenant-scoped write flag in dual-write mode: source remains authoritative while the target write is verified. Provider
   calls and cross-store writes use outbox/idempotency workflows, never distributed transactions.
6. Switch reads to PostgreSQL only for an approved tenant cohort after reconciliation is equivalent
   and the observation window is clean; then switch writes for that cohort. Retain the source adapter
   read-only for rollback until the domain is accepted.
7. Complete the checkpoint and remove Firestore writes for that domain. Repeat for the next bounded
   domain in dependency order.

Rollback is an explicit routing change to the source authority while dual-write remains enabled.
The runner records a `rolled_back` checkpoint; no destructive Firestore operation is part of this
migration. A rollback after PostgreSQL becomes authoritative requires replaying the PostgreSQL
outbox and reconciling writes made during the rollback window before another cutover.

## Billing reconciliation

The Stripe webhook path is the low-latency update path. A scheduled reconciliation worker also
lists Stripe subscriptions for known customers, recomputes plan, price, entitlement state, renewal,
trial, and cancellation fields, then records a `billing_reconciliation_runs` result. Reconciliation
is bounded per run and safe to retry; it repairs missed/out-of-order webhook effects without making
Stripe calls part of normal entitlement reads.
