# PostgreSQL commerce authority

When `POSTGRES_ENABLED=true`, commerce routes use PostgreSQL for products,
variants, prices, inventory, reservations, orders, payments, and fulfillment.
The migration command is:

```bash
npm run db:migrate
npm run migrate:commerce
```

## Invariants

- Checkout reads product/variant price and currency from PostgreSQL. Client
  price, totals, payment status, and provider identifiers are ignored.
- Checkout creates the order, line item, reservation, inventory movement, and
  `OrderCreated` outbox event in one transaction.
- Inventory uses a conditional atomic update while holding the transaction;
  a failed row count produces `OUT_OF_STOCK`. Reservations and movements are
  idempotent and movements are append-only.
- Order transitions are checked by the application state machine and the
  PostgreSQL trigger. Stripe webhook reconciliation is the only payment-status
  path and is deduplicated through `payment_events`.
- Fulfillment transitions lock the order, reconcile reservations, append
  fulfillment history, and update order state in one transaction.

## API behavior

Creator product/order lists use keyset cursors ordered by creation time and ID.
Public product responses expose database prices and availability. Checkout
requires an `Idempotency-Key`; repeated requests reuse the same order/Stripe
request. Fulfillment mutations accept an idempotency key or server request ID.

The Firestore commerce path remains only as a compatibility fallback when
PostgreSQL is disabled. After backfill reconciliation and staging checkout,
inventory-concurrency, webhook, and fulfillment tests pass, enable the
PostgreSQL path and retire the legacy collections.
