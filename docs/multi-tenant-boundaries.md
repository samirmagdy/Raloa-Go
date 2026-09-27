# Multi-tenant boundaries

The tenant boundary is the pair `(owner_user_id, site_id)`. A site-scoped repository operation must
receive both values through `TenantScope`; a resource ID alone is never sufficient authorization.
Repositories apply the tenant predicate before returning a record, and a missing or mismatched
record is treated as not found. Services must not accept a client-supplied owner ID as authority;
they derive the owner from the authenticated actor and an owned site lookup.

The reusable boundary helpers are in
[`server/core/tenant-scope.ts`](../server/core/tenant-scope.ts). New repository ports are defined
in [`server/repositories/scoped-contracts.ts`](../server/repositories/scoped-contracts.ts).
Legacy repository ports remain during migration but must be adapted behind these scoped ports before
becoming PostgreSQL write authorities.

## Database enforcement

Every site-scoped target table has `site_id`. Tables that also carry a user/creator/host owner use
composite foreign keys to `sites(id, owner_user_id)` so a valid user from another site cannot be
paired with the current site. PostgreSQL unique constraints and foreign keys are the final race-safe
boundary; controller authorization is defense in depth, not the only protection.

Global user records such as subscriptions remain user-scoped by design. Site-scoped integrations
use the same composite ownership rule, while explicitly global integrations keep `site_id IS NULL`.
Operational events may carry an optional site scope, but handlers must preserve it when processing a
site-scoped aggregate.

Cross-tenant reads, writes, mutations, and routing resolution must fail closed. Automated coverage is
in [`test-tenant-boundaries.ts`](../test-tenant-boundaries.ts); repository implementations should
also test both same-site and wrong-site IDs for every operation.
