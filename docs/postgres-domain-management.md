# PostgreSQL domain management

When `DOMAINS_POSTGRES_AUTHORITATIVE=true`, custom-domain state is stored in
PostgreSQL `custom_domains`. Ownership is resolved through `app_users` and
`sites`; the database enforces unique hostname, site, and idempotency keys.

The HTTP API only records intent and enqueues work. Cloudflare provisioning,
DNS/ownership verification, SSL readiness checks, and removal execute in the
`domain_verification` Cloud Tasks worker. Each job has a deterministic
idempotency key, bounded retries, lease recovery, and terminal failure state.

Lifecycle:

`pending → provisioning → pending verification → verified`

Failures are persisted as `failed` with `last_error`; they are never converted
to an empty domain list. Domain reads return `503 DOMAINS_UNAVAILABLE` when the
database is unavailable, and only `verified` domains with active SSL are used
for public routing.

The existing Firestore implementation remains available until the flag is
enabled and migration/reconciliation evidence is complete. Cloudflare calls
remain provider-adapter calls and never run inside a PostgreSQL transaction.
