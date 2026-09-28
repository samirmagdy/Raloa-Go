# PostgreSQL booking scheduling

When PostgreSQL is enabled, booking services, weekly availability rules,
exceptions, blackout dates, materialized slots, and bookings are read and
written from PostgreSQL. The legacy Firestore booking path remains only when
the PostgreSQL runtime is not enabled.

## Relational model

- `booking_services` stores duration, buffer, timezone, notice window, booking
  window, and daily booking limits.
- `availability_rules` stores one or more weekly windows per site and weekday.
- `availability_exceptions` stores UTC blackout intervals.
- `booking_blackout_dates` stores explicit local calendar-date blackouts.
- `booking_slots` stores generated UTC slots with the schedule timezone,
  capacity, and booked count.
- `bookings` stores the authoritative lifecycle state and customer data.

Run the schedule backfill after sites have been migrated:

```bash
npm run db:migrate
npm run migrate:booking-schedules
npm run migrate:bookings -- backfill
```

## Consistency guarantees

Reservation executes in one PostgreSQL transaction:

1. Resolve the site, host, service, and idempotency key.
2. Lock the materialized slot with `SELECT ... FOR UPDATE`.
3. Reject blocked or exhausted slots.
4. Insert the booking.
5. Increment the slot count and mark it booked when capacity is reached.
6. Record idempotency and the `BookingCreated` outbox event.

The slot uniqueness constraint, active-slot uniqueness index, exclusion
constraint for overlapping active bookings, and row lock prevent application
timing checks from being the source of truth. Booking status transitions are
guarded by a PostgreSQL trigger.

All instants are stored as `timestamptz`. The schedule timezone is stored with
the service and slot. Weekly rules and blackout dates are interpreted in that
timezone, while persisted slot boundaries remain UTC.

## API cutover

With PostgreSQL enabled, public scheduling config and availability are read from
the relational schedule, public reservations use the transactional repository,
and creator list/confirm/cancel operations use PostgreSQL. Confirmation and
cancellation remain authoritative booking state transitions; calendar/email
side effects are eventual and must be handled by workers.

`npm run test:booking-concurrency` races two reservations against the same
slot. It requires a test PostgreSQL connection; without one it reports a
visible skip rather than claiming concurrency was verified.
