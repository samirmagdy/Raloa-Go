# ADR-0001: PostgreSQL for transactional domains

- Status: Accepted
- Date: 2026-09-27

## Context

Bookings, availability, inventory, orders, subscriptions, integrations, domains, and bounded operational analytics require relational constraints, transactions, idempotency, and locking.

## Decision

Use managed PostgreSQL as the target transactional datastore. Introduce it domain by domain behind repository contracts and the strangler router; do not perform a big-bang cutover.

## Alternatives

Continue using Firestore for all domains, use a different managed SQL database, or rewrite directly against PostgreSQL without an abstraction layer.

## Tradeoffs

PostgreSQL adds connection, migration, and operational management costs, but provides foreign keys, exclusion/unique constraints, row locks, and auditable transactions that are difficult to enforce consistently in document storage.

## Migration impact

Additive SQL migrations, dual-read/dual-write tooling, reconciliation, feature-flagged tenant rollout, and backward-compatible application releases are required. Firestore remains a compatibility source until each domain is proven equivalent.

## Reversal strategy

Disable the domain write/read flags and route traffic to the Firestore adapter. Keep PostgreSQL data and outbox events for reconciliation; do not destructively reverse committed schema migrations.
