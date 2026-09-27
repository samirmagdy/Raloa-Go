# Commerce PostgreSQL migration

Products, orders, inventory, payments, and fulfillment use repository contracts. Firestore remains the default implementation until a site/tenant cohort passes backfill, reconciliation, shadow reads, and dual-write verification.

## PostgreSQL guarantees

- Product/order legacy IDs are preserved in `legacy_product_id` and `legacy_order_id`; API identifiers do not change.
- Inventory mutations lock the variant inventory row with `FOR UPDATE`, validate available stock, update balances, and append an idempotent movement in one transaction.
- Inventory movements are append-only and keyed by idempotency key.
- Order transitions lock the order, validate the state-machine transition, write transition history with a unique transition key, update authoritative status, and append an outbox event in one transaction.
- Payments deduplicate provider payment/event IDs through unique keys.
- Fulfillment is one-to-one with an order and cannot be written as a second fulfillment record.

## Rollout

Use the commerce flags per tenant/site:

- `commerce.postgres.reads.v2` — shadow or target reads;
- `commerce.postgres.writes.v2` — dual-write with Firestore authoritative;
- `commerce.postgres.authoritative.v2` — target-authoritative reads/writes.

Disable the authoritative flag to roll back. Provider calls, Stripe webhooks, and email remain outside database transactions; webhook handlers first deduplicate and persist internal payment state, then transition orders transactionally.

The repository implementations are in `server/infrastructure/postgres/commerce-repositories.ts`. No route is allowed to import Drizzle or `pg` directly.
