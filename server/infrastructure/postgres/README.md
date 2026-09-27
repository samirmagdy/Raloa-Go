# PostgreSQL persistence boundary

Drizzle is the PostgreSQL ORM choice. It provides typed table/query APIs while
preserving explicit SQL and transaction control needed by booking overlap
constraints, inventory reservations, order state guards, outbox publishing,
and idempotency records.

`db/migrations/001_postgres_target_schema.sql` remains the schema authority.
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
