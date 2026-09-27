# PostgreSQL transactional schema

PostgreSQL is the target datastore for strongly consistent domains. Firestore remains the current production datastore until a bounded migration switches a domain's authoritative reads and writes.

## Ownership model

- `app_users` mirrors Firebase identity; it is not the authorization decision.
- `accounts` and `account_memberships` provide the future tenant boundary.
- `sites` keeps `owner_user_id` for compatibility and has a nullable `account_id` during the strangler migration.
- Domain rows carry `site_id` or `user_id` and use composite ownership foreign keys where the relationship must be proven by the database.

## Transactional domains

| Domain | Tables | Consistency boundary |
| --- | --- | --- |
| Bookings | `booking_services`, `availability_rules`, `availability_exceptions`, `booking_slots`, `bookings`, `booking_attendees`, `calendar_sync_state`, `booking_idempotency_keys` | Lock the slot, verify capacity/conflicts, create the booking and outbox event in one transaction. Calendar/email delivery is asynchronous. |
| Commerce | `products`, `product_variants`, `inventory`, `inventory_reservations`, `inventory_movements` | Lock inventory rows, reserve stock, and append movement records atomically. Expiry/release workers are idempotent. |
| Orders | `orders`, `order_items`, `order_state_history`, `payments`, `payment_events`, `fulfillments` | Validate state transitions and payment deduplication in one transaction. Stripe calls/webhooks are never part of a database transaction. |
| Billing | `billing_price_mappings`, `billing_customers`, `subscriptions`, `subscription_state_history`, `billing_webhook_events`, `billing_reconciliation_runs` | Persist provider events once, update internal subscription/entitlement state transactionally, and reconcile asynchronously. |
| Integrations | `integrations` | Token rotation and refresh leases update one connection atomically; encrypted credentials are backend-only. |
| Platform | `custom_domains`, `media_assets`, `media_variants` | Persist lifecycle state first; provider provisioning and media processing run through jobs. |
| Events/jobs | `outbox_events`, `operational_jobs` | Domain state and an outbox row commit together. Claims use leases, idempotency keys, bounded retries, and dead-letter state. |

## Database guarantees

- UUID primary keys and audit timestamps are used throughout.
- Site-scoped ownership is represented by foreign keys, unique `(site_id, ...)` keys, and indexed tenant access paths.
- Booking overlap uses a PostgreSQL `EXCLUDE USING gist` constraint; one-to-one slot claims use a partial unique index.
- Inventory movements and audit records are append-only through database triggers.
- Order transitions are enforced by a database trigger and recorded in `order_state_history`.
- Provider webhook IDs, payment IDs, subscription IDs, job keys, and outbox keys are unique for idempotent replay.
- `002_transactional_domain_hardening.sql` adds account tenancy references and order/reservation/integration command idempotency without requiring a big-bang backfill.

The SQL migrations are authoritative. `server/infrastructure/postgres/schema.ts` is the typed Drizzle access model and must be updated in the same change; application services must depend on repository contracts rather than importing Drizzle tables directly.
