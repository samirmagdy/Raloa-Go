# PostgreSQL persistence boundary

Drizzle is the PostgreSQL ORM choice. It provides typed table/query APIs while
preserving explicit SQL and transaction control needed by booking overlap
constraints, inventory reservations, order state guards, outbox publishing,
and idempotency records.

`db/migrations` remains the schema authority (`001_postgres_target_schema.sql`
and additive follow-up migrations such as `002_transactional_domain_hardening.sql`).
`schema.ts` is a typed access model for the migration and must be updated in
the same change; it is not a second migration source. PostgreSQL repositories
under this directory return domain/repository contracts and must not expose
Drizzle table types, query builders, or transactions to services.

Operational rules:

- use `withPostgresTransaction` for multi-row state changes and outbox writes;
- keep provider calls outside database transactions;
- use parameterized Drizzle queries or explicit SQL only;
- add indexes and constraints in the SQL migration first;
- keep Firestore repositories active until a domain has passed dual-read,
  reconciliation, and rollback checks;
- treat Firestore as a bounded exception for editor configuration and realtime
  collaboration, never as the default for a new transactional domain.

Bookings are the first migration pilot. The PostgreSQL booking adapter lives in
`bookings-repository.ts`; it is only selected by the booking migration router
when the booking-specific flags are enabled. Firestore remains the default
source and rollback path.

ORM selection is recorded in [ADR-0008](../../docs/adr/0008-postgresql-orm.md).
Do not add Prisma, Prisma Client, or a second migration generator without a new
ADR and an explicit reversal/migration plan.
