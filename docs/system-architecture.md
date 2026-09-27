# System architecture conformance

This document maps the requested platform architecture to the current repository. The architecture is implemented as a modular monolith with operational deployment roles. The public Next.js renderer is the only intentional transitional gap; forcing that migration would contradict the incremental migration boundary.

```text
Cloudflare DNS/CDN/domains
          |
   public-web compatibility renderer  ---> cached published site data
          |
      studio-api / modular TypeScript application
          |             |              |
      PostgreSQL      Firestore      provider adapters
   transactions       editor/realtime  Stripe/Google/Microsoft/Cloudflare/email/storage
          |
       domain events + transactional outbox
          |
       Cloud Tasks / Pub/Sub
          |
       background worker
          |             |
     provider sync   analytics/media processing

raw analytics -> analytical storage; rollups -> PostgreSQL
media originals/variants -> Firebase Storage or R2 -> CDN
Studio -> Vite/React authenticated application
```

## Conformance matrix

| Diagram component | Repository implementation | Status |
| --- | --- | --- |
| Cloudflare DNS/CDN/domains | `server/adapters/cloudflare*.ts`, domain provisioning service, Cloud Run ingress | Implemented |
| Public web | `raloa-public-web`, public-site adapter, published-site cache, route allowlist | Implemented as compatibility renderer |
| Next.js SSR/metadata | `docs/next-migration-boundary.md`, shared public schemas/design contracts | Planned incremental boundary; not yet deployed |
| Application API | `server.ts`, domain modules, controllers, services, repositories | Implemented |
| PostgreSQL transactions | `db/migrations`, `server/infrastructure/postgres`, repository contracts | Implemented as target/migrating authority |
| Firestore editor/config | Firestore repositories and site/editor compatibility paths | Implemented with bounded role |
| Domain events/outbox | `server/events`, `server/outbox` | Implemented |
| Cloud Tasks/Pub/Sub | `server/background-jobs`, worker dispatchers, `worker.ts` | Implemented |
| External integrations | `server/adapters`, integration/OAuth services | Implemented |
| Analytics pipeline | `server/infrastructure/analytics`, rollup repositories, analytical-storage policy | Implemented with warehouse adapter boundary |
| Media storage/CDN | media service, Firebase/R2 adapters, processing worker | Implemented |
| Studio | Existing React/Vite authenticated application | Implemented |

## Required invariants

- Public traffic cannot reach private Studio/API routes through the public service allowlist.
- Domain services depend on interfaces; persistence and provider SDKs stay in adapters/composition roots.
- PostgreSQL owns new relational transactions; Firestore remains an explicit editor/realtime or migration exception.
- Domain state and outbox events are committed atomically where the persistence boundary supports it.
- External calls happen in idempotent workers, never inside a database transaction.
- Public data is cacheable only after publication; private Studio state and authorization decisions are not public-cacheable.
- Next.js promotion requires a real public app, shared-schema consumption, staging smoke evidence, and a reversible feature-flagged route cutover.

Conformance is checked by `npm run check:system-architecture` and the deployment topology, persistence boundary, modular-monolith, capacity, and CI/CD checks.
