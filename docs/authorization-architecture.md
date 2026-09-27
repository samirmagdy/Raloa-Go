# Authorization architecture

Authentication and authorization are separate responsibilities:

- **Firebase Auth** verifies the bearer/session token and establishes the immutable identity (`uid`,
  optional email). It does not decide site ownership, workspace membership, roles, plan access, or
  resource permissions.
- **Application authorization** loads the account, workspace, site ownership, membership role, plan
  entitlements, and tenant scope from application repositories. It produces an
  `AuthorizationContext` used by services and policies.

The centralized policy is in
[`server/core/authorization-policy.ts`](../server/core/authorization-policy.ts). Controllers
should authenticate once, resolve a context for the requested site, and call `assertCan` and
`assertEntitled`; they should not duplicate owner checks, plan checks, or role matrices.

## Policy order

1. Verify Firebase identity.
2. Load the application account and requested site through tenant-scoped repositories.
3. Resolve workspace membership and role. Site ownership always grants the owner role.
4. Build plan capabilities from the authoritative internal billing/account state.
5. Enforce the action and entitlement in the application service before persistence or provider I/O.
6. Pass the resulting context into repository calls so queries remain tenant-scoped.

Missing account, site, membership, or resource ownership fails closed as `RESOURCE_NOT_FOUND` to
avoid leaking cross-tenant existence. A known identity is not automatically an application member.
Plan entitlements are server-derived and client payloads cannot elevate them.

The policy matrix and denial behavior are covered by `npm run test:authorization-policy`.
