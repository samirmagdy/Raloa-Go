# Architecture decision records

ADRs capture decisions that affect multiple domains, deployment, persistence, or operational ownership. They are intentionally short and link to the detailed implementation documents where appropriate.

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](0001-postgresql-transactional-datastore.md) | PostgreSQL for new transactional domains | Accepted |
| [0002](0002-firestore-role.md) | Firestore retained for editor/realtime exceptions | Accepted |
| [0003](0003-nextjs-public-boundary.md) | Incremental Next.js public-rendering boundary | Accepted |
| [0004](0004-background-processing.md) | Cloud Tasks/Pub/Sub for durable background work | Accepted |
| [0005](0005-media-storage.md) | Provider-neutral media storage adapters | Accepted |
| [0006](0006-analytics-storage.md) | PostgreSQL rollups plus analytical raw-event storage | Accepted |
| [0007](0007-authentication.md) | Firebase Auth for identity | Accepted |
| [0008](0008-postgresql-orm.md) | Drizzle behind repository contracts | Accepted |
| [0009](0009-deployment-topology.md) | Cloud Run modular deployment topology | Accepted |

Run `npm run check:adrs` to verify every ADR records alternatives, tradeoffs, migration impact, and reversal strategy.
