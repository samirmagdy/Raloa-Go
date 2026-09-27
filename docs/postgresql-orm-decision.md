# PostgreSQL ORM decision

The authoritative decision is [ADR-0008](adr/0008-postgresql-orm.md). This
document is the short implementation summary.

## Decision

Use Drizzle behind `server/infrastructure/postgres`.

## Evaluation

| Criterion | Drizzle | Prisma |
| --- | --- | --- |
| Migration quality | Existing SQL remains authoritative; incremental adoption is straightforward | Prisma migrations would introduce a second schema workflow or require conversion |
| SQL control | Strong: typed builders plus explicit SQL for exclusion constraints, locks, and CTEs | Possible, but advanced PostgreSQL behavior often needs raw SQL escape hatches |
| Transactions | Explicit transaction boundaries fit booking, inventory, orders, and outbox workflows | Strong interactive transactions, but more runtime abstraction than needed here |
| Type safety | Typed table/query model without leaking generated client objects | Excellent generated client types, but broader client coupling |
| Operational simplicity | Small adapter surface; standard `pg` pool | Prisma engine/runtime and generated-client lifecycle add deployment overhead |

The application must depend on repository contracts, not Drizzle. This permits
Firestore implementations during migration and PostgreSQL implementations
without rewriting services or API contracts.

The current change implements only the database foundation: pooled `pg`
connections, Drizzle's typed infrastructure schema, health checks, and the
existing SQL migration runner. No business domain has switched persistence.
