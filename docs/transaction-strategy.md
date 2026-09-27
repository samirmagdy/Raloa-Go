# Database transaction strategy

This document is the consistency contract for the modular backend. It applies to both the current
Firestore repositories and the PostgreSQL target. The repository implementation may change, but an
application service must preserve the same boundary and idempotency behavior.

## Rules

1. A transaction may contain domain reads, domain writes, constraints, and the outbox record needed
   to continue the workflow.
2. A transaction must not call Stripe, Cloudflare, Firebase, Google, Microsoft, an email provider,
   a calendar API, or a media processor. Those calls happen after commit in a durable worker.
3. Every retried request or worker has a stable idempotency key. Unique constraints and stored
   results turn retries into no-ops or the original result.
4. External side effects use an outbox, provider idempotency key, state machine, and reconciliation
   job. The system never attempts a distributed transaction with an external provider.
5. PostgreSQL repositories own SQL and transaction mechanics. Services depend on repository ports;
   controllers do not open transactions or access a database directly.

## Strong-consistency boundaries

| Operation | Single-database transaction | Required atomic work | External boundary |
| --- | --- | --- | --- |
| Booking reservation | Yes | Claim request; lock all slots; validate capacity; write booking and attendees; update counters; write outbox | Calendar/email jobs after commit |
| Inventory reservation | Yes | Claim checkout; lock inventory; check available stock; write order, items, reservation, and append-only movement | Stripe checkout after commit |
| Payment reconciliation | Yes for internal state | Claim `(provider, event_id)`; lock order/payment/reservation; apply payment; consume or release stock; write outbox | Stripe webhook delivery is outside the DB transaction |
| Subscription update | Yes for internal state | Claim webhook; upsert customer/subscription; append state history; update entitlements; write outbox | Stripe API and periodic reconciliation are separate workflows |
| Slug uniqueness | Yes | Normalize slug; reserve slug; update ownership mapping; rely on unique constraint | Any cache invalidation after commit |
| Fulfillment | Yes | Validate server-side order transition; write transition history; update fulfillment and inventory movements; write outbox | Shipping/email integrations after commit |

For PostgreSQL, the transaction uses `FOR UPDATE` on mutable rows and database constraints for the
final race check. Booking slot overlap uses the exclusion/unique constraints in the target schema;
inventory availability is calculated only after locking the inventory row. For Firestore, the same
work is enclosed in `runTransaction` and the transaction callback must not perform provider I/O.

## Claim-then-apply provider events

Payment and subscription webhooks have two related database transactions:

1. Atomically claim `(provider, provider_event_id)` as `processing`, or return the stored result if
   the event was already applied.
2. In a short internal transaction, lock the affected aggregate and apply the event, histories,
   inventory changes, entitlements, and outbox records. Mark the event `processed` in that same
   transaction. A failure leaves it retryable; a bounded retry policy eventually dead-letters it.

The provider request is therefore not part of either database transaction. If a webhook is lost, a
reconciliation worker fetches provider state and submits a new idempotent internal application.
Out-of-order events are accepted only when the domain state machine/version rules allow them.

## Eventual-consistency workflows

Calendar synchronization, email delivery, domain verification, OAuth refresh, media processing,
analytics rollups, Stripe reconciliation, and cache invalidation are durable jobs. The initiating
transaction persists the intent/outbox event; a worker claims the job, performs external I/O outside
the database lock, then commits success, retry, or dead-letter state. Each handler is safe to run
more than once and records a stable job ID or provider idempotency key.

OAuth refresh has an additional lease: acquire a row lock or refresh lease, call the provider after
that short transaction ends, and conditionally write the rotated token only if the lease/version is
still current. Raw tokens never cross the controller or frontend boundary.

## Transaction limits and retries

- Keep strong-consistency transactions short and bounded; do not wait on network calls.
- Lock rows in a deterministic order when multiple variants or slots are involved.
- Retry serialization/deadlock failures with bounded jitter. Re-run the complete transaction, not an
  individual statement.
- Treat unique-constraint conflicts as the final concurrency decision and return the existing
  idempotent result where applicable.
- Use `FOR UPDATE SKIP LOCKED` only for worker claims, never for customer-visible availability checks.
- Do not make analytics, notifications, or provider reconciliation part of a booking/order commit.

The machine-readable catalog is maintained in
[`server/infrastructure/transactions/policy.ts`](../server/infrastructure/transactions/policy.ts)
and is covered by `npm run test:transaction-policy`.
