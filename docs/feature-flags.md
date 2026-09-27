# Feature flags

Feature flags are evaluated by the backend through [`server/infrastructure/feature-flags`](../server/infrastructure/feature-flags). Frontend visibility is informational only; services must evaluate the flag again before changing persistence, rendering, provider behavior, or job routing.

## Managed flags

| Flag | Intended rollout |
| --- | --- |
| `postgres.reads.v2` | Move tenant reads to PostgreSQL after shadow-read equivalence checks. |
| `postgres.writes.v2` | Move tenant writes to PostgreSQL after dual-write reconciliation. |
| `bookings.postgres.reads.v2` | Compare or serve booking reads from PostgreSQL for an approved booking cohort. |
| `bookings.postgres.writes.v2` | Dual-write bookings while Firestore remains authoritative. |
| `bookings.postgres.authoritative.v2` | Make PostgreSQL authoritative for the approved booking cohort; disable to roll back. |
| `commerce.postgres.reads.v2` | Shadow or serve products/orders/inventory reads from PostgreSQL. |
| `commerce.postgres.writes.v2` | Dual-write commerce state while Firestore remains authoritative. |
| `commerce.postgres.authoritative.v2` | Make PostgreSQL authoritative for the approved commerce cohort; disable to roll back. |
| `public-rendering.v2` | Route selected public sites to the new renderer. |
| `background-jobs.v2` | Move selected job kinds to the durable worker path. |
| `integrations.v2` | Enable new provider adapter behavior for selected tenants. |
| `studio-capabilities.v2` | Roll out new Studio capabilities without exposing unfinished controls globally. |

Each flag supports global enablement, a tenant allowlist, deterministic percentage rollout, versioned updates, and an emergency kill switch. The Firestore repository stores documents in `feature_flags/{key}` and is intentionally read at evaluation time, so operators can disable a broken path without rebuilding or redeploying the application. Missing flags default to disabled.

## Safe rollout

1. Leave the flag disabled while code and migrations are deployed.
2. Enable it for one or more tenant IDs and validate logs, metrics, reconciliation, and user workflows.
3. Increase `rolloutPercentage` gradually only after the bounded cohort is healthy.
4. Set `killSwitch: true` to immediately disable a risky path. The service fails closed even when `enabled` remains true.
5. Preserve the prior flag document/version and revert with a new versioned update after the incident. This provides an operational rollback without code deployment.

Rollout identity is tenant-first, then site/user. Percentage bucketing is deterministic for a flag and tenant, so a tenant does not move between cohorts on each request. A percentage rollout without a tenant/site/user context is rejected as `no_subject`.

Flag mutations belong to a trusted operations path and should be audited with actor, key, old/new state, reason, and timestamp. Never accept flag state from a browser request, client bundle, or persisted site configuration.
