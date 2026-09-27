# Audit logging

Sensitive creator and administrative actions are recorded through the centralized audit service in `server/audit`. The service is the only application write path: callers provide an action and resource context, while the service supplies the event ID, timestamp, actor default, and bounded metadata.

## Contract

Every entry contains actor (`user`, `system`, or `provider`), optional tenant/site ownership, resource type and ID, action, timestamp, request/trace correlation IDs, and non-secret metadata. Metadata is scalar-only, capped, length-limited, and drops keys that commonly contain credentials, tokens, cookies, passwords, request bodies, or provider payloads.

The action catalog covers publication changes, site deletion, domain provisioning/verification/deletion, billing changes and webhook processing, integration connect/disconnect, order and fulfillment transitions, and administrative changes. New actions must be added to the versioned catalog before use.

## Persistence and immutability

The current Firestore repository uses `create()` and has no update/delete method. PostgreSQL uses `audit_log` with append-only database triggers rejecting `UPDATE` and `DELETE`, plus indexes for resource, site, actor, and action timelines. Audit writes should occur in the same transaction as the protected state mutation when the persistence boundary supports it; provider webhooks and asynchronous workflows use a system/provider actor and provider event ID, never the raw provider payload.

Audit records are operational evidence, not an event warehouse. Access to audit history must go through an authorization policy and must be tenant-scoped. Retention, export, and deletion exceptions require an explicit compliance policy; application routes must never expose raw credentials or full request bodies through audit metadata.

