# Bookings PostgreSQL migration runbook

Bookings migrate behind the existing `BookingsRepository` contract. The public API remains unchanged while the storage route is rolled out per site/tenant.

## Preconditions

1. Apply all PostgreSQL migrations through `npm run db:migrate` and verify them with `npm run db:migrate:verify`.
2. Backfill the referenced `app_users`, `sites`, and `booking_services` rows. Legacy Firestore IDs must be mapped to UUID rows; they must not be cast to UUIDs.
3. Ensure `POSTGRES_ENABLED=true` only in the migration/runtime environment that is prepared to connect to PostgreSQL.

## Backfill and reconciliation

```bash
npm run migrate:bookings -- backfill
npm run migrate:bookings -- reconcile
```

Backfill is checkpointed in Firestore under `migration_checkpoints/bookings`, is page-based, and is safe to resume. The `booking_id_map` table preserves Firestore booking IDs for API responses. `legacy_payload` preserves compatibility fields that are not part of the normalized relational model.

Reconciliation compares normalized records, reports missing target records, mismatches, and target-only records, and exits non-zero when equivalence is not proven.

## Verification gate

Run the verification command against seeded or staging data before enabling the authoritative flag:

```bash
npm run verify:bookings
```

Set `BOOKING_VERIFY_CANCELLED_IDS` to verify cancellation state and calendar-job cancellation. Set `BOOKING_VERIFY_CONCURRENCY=true` plus `BOOKING_VERIFY_SITE_ID`, `BOOKING_VERIFY_HOST_USER_ID`, `BOOKING_VERIFY_SERVICE_ID`, `BOOKING_VERIFY_SLOT_START`, and `BOOKING_VERIFY_SLOT_END` to run two simultaneous PostgreSQL reservations for the same slot; exactly one must succeed. Successful verification can be promoted with:

```bash
npm run verify:bookings -- cutover
```

The command exits non-zero and refuses the cutover checkpoint when any reconciliation, cancellation, calendar-job, or concurrency assertion fails. The authoritative feature flag still requires an explicit operator rollout.

## Rollout flags

- `bookings.postgres.reads.v2`: compare source reads with PostgreSQL while Firestore remains the response authority.
- `bookings.postgres.writes.v2`: dual-write source and target; Firestore remains authoritative for rollback.
- `bookings.postgres.authoritative.v2`: serve reads and writes from PostgreSQL for the allowlisted cohort.

Flags are tenant/site scoped and fail closed. Disable the authoritative flag to roll back reads and writes to Firestore. Keep dual-write/reconciliation enabled until all writes made during rollback are repaired.

## Consistency guarantees

The PostgreSQL target reserves a materialized slot inside one transaction: it locks the slot row, checks capacity, inserts the booking, increments the slot counter, records idempotency, writes the booking ID map, and appends `BookingCreated.v1` to the outbox. PostgreSQL exclusion and unique constraints remain the final protection against overlapping or duplicate reservations.

Provider calls, email, and calendar synchronization remain outside the booking transaction and are driven asynchronously from the outbox/job boundary.
