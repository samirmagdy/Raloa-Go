# ADR-0008: Drizzle behind repository contracts

- Status: Accepted
- Date: 2026-09-27

## Context

PostgreSQL is being introduced as the target authoritative database for transactional domains, but Firestore remains the active application source of truth until each domain completes a controlled migration. The repository already has a SQL-first migration runner, a standard `pg` pool, Cloud Run API/worker deployments, and repository contracts that must remain stable while persistence implementations change.

The target database needs PostgreSQL-specific behavior: exclusion constraints for booking overlap, row locks for inventory, explicit transaction boundaries, idempotent upserts, append-only records, and transactional outbox writes. The ORM must remain an infrastructure detail and must not leak into application services or API contracts.

## Decision

Use Drizzle with the standard `pg` pool only under `server/infrastructure/postgres`. Keep checked-in SQL migrations under `db/migrations` authoritative. Use Drizzle for typed table/query composition and explicit `sql`/`pg` operations where PostgreSQL features or locking semantics require it.

The database foundation consists of:

- `server/infrastructure/postgres/config.ts` for environment validation and pool sizing;
- `server/infrastructure/postgres/client.ts` for pool/database construction and transaction handling;
- `server/infrastructure/postgres/health.ts` for readiness checks;
- `server/infrastructure/postgres/schema.ts` for the typed access model;
- `scripts/run-postgres-migrations.mjs` and `scripts/verify-postgres-migrations.mjs` for locked, checksum-tracked SQL migrations.

This decision does not migrate business domains or switch production traffic. Domain repositories will be introduced separately behind existing contracts. The foundation is environment-complete for local, isolated test, staging, and production deployment, but traffic-inactive by design.

## Evaluation

| Criterion | Drizzle | Prisma | Decision |
| --- | --- | --- | --- |
| Migrations | Works with the repository's existing reviewed SQL, advisory lock, checksum ledger, expand/contract policy, and forward-fix process. No schema generator is required. | Prisma Migrate is capable, but adopting it would create a second migration convention or require replacing the existing SQL runner. | Drizzle |
| SQL control | Typed builders plus direct SQL preserve exclusion constraints, `FOR UPDATE`, advisory locks, partial indexes, CTEs, and database-specific functions without making them second-class escape hatches. | Strong client ergonomics, but advanced PostgreSQL behavior commonly crosses into `$queryRaw`/`$executeRaw`, weakening the single persistence convention. | Drizzle |
| Transactions | Uses the existing `pg` connection and explicit transaction helper, which makes boundaries and connection ownership visible. | Interactive transactions are strong and ergonomic, but add Prisma client/runtime semantics around the same boundaries. | Drizzle |
| Type safety | Typed table definitions and query results are sufficient when repositories expose domain types rather than ORM types. Runtime validation remains in shared schemas. | Generated client types are excellent and more opinionated across the whole model. | Prisma has a slight ergonomics advantage; repository isolation makes Drizzle sufficient. |
| Cloud Run/serverless behavior | Small standard `pg` runtime, no query engine binary, and direct control of pool size/idle timeouts. Fits long-lived Cloud Run instances and local PostgreSQL. | Requires generated client artifacts and Prisma engine/runtime management; connection pooling still needs external discipline on Cloud Run. | Drizzle |
| Maintainability | Less magic and closer to SQL, but requires explicit schema/query conventions and code review discipline. | Higher-level CRUD API is easier for common queries, but generated model coupling and raw-query escape hatches need governance. | Drizzle for this SQL-heavy migration |
| Operational overhead | Existing dependencies, pool, health check, and migration runner are retained. | Adds Prisma schema generation, client generation in CI/builds, engine compatibility, and a migration tool decision. | Drizzle |

## Alternatives

Use Prisma Migrate and Prisma Client; use raw `pg` throughout repository implementations; or expose ORM models directly to domain code. Prisma remains a viable reversal if generated-client ergonomics outweigh SQL control after a bounded repository pilot.

## Tradeoffs

Drizzle provides type safety with SQL control and a small runtime, but requires more explicit schema/query code, SQL review, and discipline around repository boundaries. It does not replace runtime request validation, domain invariants, migration review, or transaction design. The SQL migration and Drizzle schema must be updated together, while only the SQL migration is executable schema authority.

## Migration impact

The current implementation is foundation-only: local PostgreSQL configuration, pooled connections, health checks, transaction helpers, typed schema declarations, and SQL migration tooling. Existing Firestore repositories and production request paths remain unchanged.

When a domain is migrated, introduce a PostgreSQL repository behind its existing contract, use feature flags for shadow/dual reads and writes, reconcile results, and switch authority only after evidence. Prohibit `drizzle-orm` and `pg` imports outside PostgreSQL infrastructure and migration tooling.

## Reversal strategy

Swap repository implementations back to Firestore or another SQL adapter without changing services or API contracts. Keep PostgreSQL data and SQL migrations available for reconciliation and forward repair. If Drizzle becomes unsuitable, retain the SQL migration runner and replace only the typed repository implementation with Prisma or direct `pg`; do not make business logic depend on either ORM.
