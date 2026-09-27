# PostgreSQL ORM decision

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
