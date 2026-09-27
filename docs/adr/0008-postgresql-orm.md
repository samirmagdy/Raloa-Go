# ADR-0008: Drizzle behind repository contracts

- Status: Accepted
- Date: 2026-09-27

## Context

PostgreSQL domains need type-safe queries plus explicit SQL for locks, exclusion constraints, migrations, and transactional workflows. Business logic must not depend on ORM APIs.

## Decision

Use Drizzle and the standard `pg` pool only under `server/infrastructure/postgres`. Repository contracts remain the application boundary and checked-in SQL migrations remain authoritative.

## Alternatives

Use Prisma, use raw `pg` throughout services, or expose ORM models directly to domain code.

## Tradeoffs

Drizzle provides type safety with SQL control and a small runtime, but requires more explicit schema/query code and discipline around repository boundaries.

## Migration impact

Introduce PostgreSQL repositories one domain at a time, keep Firestore implementations, and prohibit ORM imports outside infrastructure and migration tooling.

## Reversal strategy

Swap repository implementations back to Firestore or another SQL adapter without changing services or API contracts. Keep SQL migrations and data available for forward repair.
