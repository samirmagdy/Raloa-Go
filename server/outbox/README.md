# Transactional outbox

Domain transactions write their state and an `outbox_events` record in the
same Firestore transaction. PostgreSQL has the equivalent `outbox_events`
table, unique idempotency key, lease, retry, and dead-letter columns for the
database migration path.

`POST /internal/outbox/publish` claims pending events transactionally and
publishes them into the durable background-job service. Publication is safe to
repeat: event IDs and `(eventType, aggregateId)` keys remain stable, published
events are terminal, and job enqueueing is itself idempotent.

Current atomic integrations include booking creation/confirmation/cancellation,
booking notification/calendar work, and order creation. Analytics and
integration events use the same event contract for subsequent domain migration.
