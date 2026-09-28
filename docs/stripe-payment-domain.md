# Stripe payment domain

Stripe is the external billing event authority. PostgreSQL is the internal
authority for payment, order, customer mapping, subscription, and entitlement
state.

## Boundaries

- `server/adapters/stripe.ts` is the only new payment boundary that knows
  Stripe SDK event objects. It verifies signatures and normalizes events into
  `ProviderBillingEvent`.
- `server/domains/billing/payment-service.ts` owns webhook ledger claims,
  customer mapping, subscription synchronization, and idempotent event
  processing. It does not import Stripe.
- `server/infrastructure/postgres/commerce-service.ts` owns order/payment and
  inventory transitions in one transaction. Client requests cannot set payment
  status.
- `server.ts` only handles transport, signature extraction, compatibility
  selection, and the HTTP response.

## Supported lifecycle events

`checkout.session.completed`, asynchronous checkout success/failed/expired,
`customer.subscription.created|updated|deleted`, `invoice.payment_failed`,
`invoice.paid`, and refund events are normalized. Unsupported Stripe events are
acknowledged by the adapter but do not mutate domain state.

## Idempotency and retries

`billing_webhook_events(provider, provider_event_id)` is the webhook ledger.
The unique key and row lock make redelivery safe. Commerce payment events also
use `payment_events(provider, provider_event_id)`. A worker may retry failed
ledger rows using `attempt_count`, `last_error`, and the existing status index.

## Transaction boundaries

Subscription state, customer mapping, and the webhook ledger claim/finalization
are written in one PostgreSQL transaction. Order payment reconciliation and
inventory reservation consumption are written in a separate commerce
transaction because the compatibility commerce service owns that aggregate.
There is intentionally no distributed transaction with Stripe; Stripe
redelivery and reconciliation close that boundary.

## Rollout

Set `BILLING_POSTGRES_AUTHORITATIVE=true` only after applying migration 013 and
seeding `app_users`, `billing_price_mappings`, and any existing customer
mappings. With the flag disabled, the verified adapter delegates to the legacy
Firestore billing handler. This preserves the current production behavior while
the PostgreSQL path is validated.

`stripeAdapter.reconcileCustomer(customerId)` reads current Stripe
subscriptions for a scheduled reconciliation worker. Its normalized snapshots
are passed to `paymentService.reconcile(...)`, which uses the same idempotent
subscription upsert path as webhooks.
