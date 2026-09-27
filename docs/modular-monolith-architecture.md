# Modular monolith architecture

RALOA remains one application codebase and one primary composition root while domain boundaries mature. Growth alone is not a reason to create independently deployed microservices.

## Current boundary

Each bounded domain exposes an application service and repository/provider interfaces. The composition root wires Firestore repositories, provider adapters, feature flags, background jobs, and outbox dispatch. Controllers translate HTTP only; domain services do not import Express, database clients, or provider SDKs.

The public web, Studio/API, and background worker Cloud Run services are operational deployment roles sharing one compatibility image. They are not independently owned microservices: they share domain contracts, release gates, migrations, observability, and rollback procedures.

## When extraction is justified

Extract a domain only when a measured decision record demonstrates one or more of:

- independent scaling is required and cannot be met by worker/API concurrency or queue partitioning;
- deployment cadence or blast radius requires an independent release boundary;
- security or network isolation requires separate credentials or trust boundaries;
- a distinct team owns the domain operationally, including on-call, SLOs, data ownership, and rollback;
- provider workload or resource limits materially interfere with the rest of the application.

The record must include baseline metrics, the proposed contract, data ownership, failure behavior, migration/rollback plan, and operational cost. “The codebase is large” or “the folder is a domain” is insufficient.

## Extraction sequence

1. Stabilize the domain interface and repository ports inside the monolith.
2. Move asynchronous work behind durable jobs and outbox events.
3. Add contract tests for the service boundary and provider adapters.
4. Introduce a strangler router or queue boundary with shadow comparison and tenant rollout.
5. Prove independent scaling, security, or ownership value in staging and production evidence.
6. Extract only the selected implementation; retain the monolith adapter during rollback and keep API contracts unchanged.

`npm run check:modular-monolith` prevents transport/database/provider imports from leaking into domain services and verifies the required modular boundaries remain present.
