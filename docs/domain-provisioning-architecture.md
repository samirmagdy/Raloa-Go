# Custom-domain provisioning architecture

Custom domains are managed by a domain provisioning service. Studio owns the user workflow, but it
does not own DNS, certificates, provider IDs, or public-host routing decisions.

## Separate responsibilities

- **Ownership**: creator user, site, hostname uniqueness, and plan authorization.
- **DNS instructions**: normalized records the creator must publish or that an automated provider
  returns.
- **Verification**: DNS/hostname verification state and last check result.
- **Certificate**: certificate lifecycle independently tracked as pending, active, or failed.
- **Routing**: hostname-to-published-site mapping consumed by the public request path.
- **Provider operations**: Cloudflare custom-hostname calls isolated in an adapter; no Cloudflare
  response shape crosses into Studio or public routing.

The service contracts are in
[`server/domains/domains/contracts.ts`](../server/domains/domains/contracts.ts), orchestration is
in [`provisioning-service.ts`](../server/domains/domains/provisioning-service.ts), and Cloudflare
is isolated in [`cloudflare-domains.ts`](../server/adapters/cloudflare-domains.ts).

## Idempotent provisioning

Provision requests carry a stable idempotency key. The repository enforces unique hostname and
idempotency constraints. Replays return the existing domain without another provider call. Provider
metadata also includes the same key so a retry after a response timeout can be safely reconciled.

Provisioning state is explicit: `pending`, `provisioning`, `verified`, `failed`, or `deleted`.
Verification and certificate activation are separate transitions. Provider calls happen outside
database transactions; failures persist `last_error` and can be retried by a durable
`domain_verification` job.

## Public routing boundary

Public routing calls `resolvePublicRouting(hostname)` and receives either a normalized routing
record or `null`. It only returns mappings that are verified, certificate-active, and configured for
published content. It does not read Studio state, inspect UI assumptions, or call Cloudflare during
the request. DNS verification, certificate polling, and provider reconciliation run asynchronously.

Deletion is idempotent and provider cleanup is retried independently. A deleted or incomplete
domain can never become an active public route.
