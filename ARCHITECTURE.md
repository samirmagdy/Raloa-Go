# Raloa target repository architecture

This repository is being moved toward a modular monolith with explicit application boundaries. The current Vite/Express application remains active during the migration.

## Runtime boundary

```text
apps/web                 Next.js public web + future Studio shell
apps/workers             Cloud Tasks worker entrypoints
        |
packages/api             transport contracts/controllers
        |
packages/domain         framework-independent use cases and invariants
        |
packages/database       repository contracts and transaction ports
packages/providers       Stripe, Firebase Auth, R2, Cloudflare, Tasks adapters
packages/schemas         Zod runtime contracts and inferred types
packages/auth            identity and authorization ports
packages/observability  logs, tracing, Sentry ports
packages/config         validated runtime configuration
packages/ui              framework-neutral UI contracts/components
packages/blocks          site block schemas/rendering contracts
packages/design-system  tokens and visual primitives
```

The dependency direction is one-way:

```text
UI/apps -> API/application services -> domain -> repository/provider interfaces
                                                     ^
                                     infrastructure adapters implement ports
```

Domain packages must not import Express, Next.js, React, Firebase Admin, Stripe, Cloudflare SDKs, `pg`, or Firestore. Provider SDKs belong only in adapter implementations. Routes/controllers translate HTTP to application commands and never perform database or provider calls directly.

## Compatibility policy

- The existing Vite/Express app, `server.ts`, `src/`, and current tests remain in place.
- No data migration or production read/write cutover is performed by creating this structure.
- New code may depend on package contracts; package contracts may not depend on legacy application entrypoints.
- Legacy modules are migrated behind these ports one bounded context at a time.
- The current package remains the runnable default until `apps/web` and `apps/workers` are promoted explicitly.

## Package ownership

| Package | Owns | Must not own |
|---|---|---|
| `domain` | entities, value objects, invariants, application service ports | framework/provider SDK calls |
| `database` | repository and transaction interfaces | HTTP, provider SDKs, UI |
| `auth` | identity, tenant context, authorization policy interfaces | UI login screens or Firebase SDK internals |
| `schemas` | versioned Zod contracts and inferred types | persistence or transport execution |
| `api` | request/response contracts, error envelope, controller ports | SQL/Firestore/provider calls |
| `providers` | typed provider interfaces and adapters | domain decisions |
| `observability` | structured telemetry ports and Sentry adapter boundary | business workflows |
| `config` | validated environment/config contracts | application behavior |
| `blocks` | normalized site blocks and render contracts | React-specific page orchestration |
| `design-system` | design tokens and visual contracts | domain data fetching |
| `ui` | reusable presentation contracts/components | direct auth/database/provider SDK use |
| `apps/web` | Next.js composition and route wiring | business rules and direct persistence |
| `apps/workers` | Cloud Tasks composition and job dispatch | domain persistence implementation |

