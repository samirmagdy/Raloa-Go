# Central authorization policy

Authorization is a server-side application concern. Firebase establishes the
identity; `@raloa/auth` resolves the internal user, account membership, site
ownership, role, resource ownership, and plan entitlements before an operation
is allowed.

## Boundary

Route handlers and server actions call `requireAccount`, `requireSiteAccess`,
or `requireResourceAccess`. They do not compare browser-submitted user IDs,
read provider SDK state, or implement role rules locally. Resource repositories
return ownership metadata only; the policy layer makes the decision.

The dependency direction is:

```text
HTTP / server action -> authorization helper -> policy -> ownership data source
```

No browser/UI visibility rule is a security boundary.

## Resource policy

The authoritative resource vocabulary is:

`account`, `site`, `audience`, `booking`, `product`, `order`, `domain`,
`media`, `integration`, `billing`, `analytics`, `publishing`, and
`destructive`.

Actions are explicit, for example `booking:manage`, `billing:read`,
`publishing:rollback`, and `destructive:delete`. Unknown resources, actions,
roles, missing ownership metadata, and missing tenant membership are denied.

Owner and admin can manage tenant resources. Editors can operate content,
audience, bookings, products, orders, media, and publishing, but cannot manage
billing, integrations, domains, or destructive administration. Viewers have
read-only access. The exact matrix is executable in `packages/auth/src/index.ts`
and is covered by `test-authorization-resources.ts`.

## Error behavior

- `401` means no valid Firebase identity or no provisioned internal user.
- `404` means the resource does not exist **or is outside the caller's tenant**.
  This prevents cross-tenant resource enumeration.
- `403` means the resource is in the caller's tenant but the role cannot
  perform the requested action.
- `403 ENTITLEMENT_REQUIRED` means authorization succeeded but the account plan
  does not include the requested capability.

## Tenant resolution

The browser may provide a resource identifier as a lookup key, but never an
identity, account, owner, role, or tenant assertion. The data source resolves
the resource's `accountId`/`siteId` and owner on the server. The policy then
requires account membership and derives the role from trusted records.

PostgreSQL uses the ownership foreign keys and account memberships. During the
Firestore transition, the same policy interface is backed by the Firestore
ownership lookup. This keeps the API contract stable while the datastore is
migrated.

## Required usage

```ts
await requireResourceAccess('booking', bookingId, 'booking:manage');
await requireResourceAccess('media', assetId, 'media:write');
await requireResourceAccess('site', siteId, 'publishing:publish');
```

Destructive operations must use an explicit `destructive:*` action and must
still identify the target resource. There is no implicit delete permission.

## Test requirement

Every resource category has a negative test proving that a tenant-A identity
cannot access a tenant-B resource. The test also verifies default denial for
unknown actions and editor denial for billing/destructive administration.
