# PostgreSQL transactional outbox

The PostgreSQL outbox is the hand-off between a committed domain change and
asynchronous work. A domain transaction updates its rows and inserts an
`outbox_events` row before `COMMIT`; a Cloud Tasks-triggered worker later
claims, publishes, and acknowledges the row. Provider calls never participate
in the database transaction.

## Contract

Each event has a stable UUID, `event_type`, explicit `event_version`, aggregate
identity, idempotency key, correlation ID, JSON payload, attempt counters,
lease timestamps, and terminal timestamps. `Name.v1` is the current event
contract. A new payload contract is a new event version; consumers must keep
supporting old versions during rollout.

`idempotency_key` prevents duplicate producers. Consumers use a stable
`(event_id, consumer_key)` row in `outbox_event_consumers`; a processed row is
never executed again. Cloud Tasks delivery is also idempotent because the job
ID is deterministic.

## Processing and recovery

1. `listDue` finds pending/retry rows.
2. `claim` uses an atomic update and lease, so concurrent workers cannot own a
   row at the same time.
3. The consumer performs its work with its own idempotency boundary.
4. `markPublished` records processed/published time. Failures use bounded
   exponential backoff and become `dead_letter` after the configured limit.
5. Expired leases are eligible for redelivery. Operators can replay one event
   or every event for a correlation ID through the protected internal replay
   endpoint.

## Transaction boundaries

- Bookings: slot lock, booking row, slot counter, idempotency record, and
  `BookingCreated`/`BookingCancelled` outbox row are one transaction.
- Orders: order/inventory reservation and `OrderCreated` or state-transition
  event are one transaction.
- Publishing: immutable snapshot, current publication pointer, audit record,
  and `SitePublished`/`SiteUnpublished` event are one transaction.
- Subscriptions: Stripe webhook ledger, internal subscription update, and
  `SubscriptionChanged` event are one transaction.
- Media and domains: the current R2/Cloudflare compatibility paths continue
  to use their existing repositories and durable jobs. Their PostgreSQL
  metadata/provisioning migrations must use the same append API before those
  paths are made authoritative; external storage/DNS calls remain outside the
  transaction.

The protected `/internal/outbox/publish` endpoint processes both legacy
Firestore and PostgreSQL outboxes during the strangler migration. PostgreSQL
processing is enabled with `OUTBOX_POSTGRES_AUTHORITATIVE=true` and can be
rolled back by disabling that flag without deleting either datastore.
