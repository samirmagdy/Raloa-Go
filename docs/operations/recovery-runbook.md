# Production recovery and restoration runbook

This runbook covers the current Cloud Run, PostgreSQL, Cloudflare R2, Firebase Auth, Stripe, Cloud Tasks, Secret Manager/KMS, and domain-provider topology. It is an operational procedure, not a substitute for provider-specific service-level agreements.

## Recovery objectives

The initial production targets are deliberately achievable for a managed PostgreSQL deployment with Cloud Run and provider-managed object storage:

| Workload | RPO | RTO | Notes |
| --- | ---: | ---: | --- |
| PostgreSQL transactional data | 5 minutes | 60 minutes | Continuous WAL/PITR plus daily verified backups; restore to a new instance and cut over |
| Public published pages | 15 minutes | 30 minutes | CDN/cache may continue serving the last valid snapshot during database recovery |
| R2 media objects | 0 after acknowledged upload | 4 hours | R2 is the object authority; metadata and lifecycle state follow PostgreSQL backups |
| Firebase Auth identity | Provider-dependent | 2 hours | Auth is not locally restorable; fail closed and preserve existing sessions only within their valid lifetime |
| Stripe payment/subscription state | No acknowledged event loss | 60 minutes | Stripe remains event authority; replay from the webhook ledger/provider dashboard |
| Cloud Tasks jobs | 1 minute | 60 minutes | Reconcile pending/leased jobs and replay idempotently |

RPO measures maximum accepted data loss. RTO measures time to restore safe service, not time to complete every asynchronous reconciliation. Any change to these objectives requires an ADR and capacity/cost review.

## Incident roles and safety

The incident commander declares the recovery mode, records timestamps, and approves cutover. The database operator performs backup/PITR/restore and verifies constraints. The application operator deploys the last known-good release and updates database connection configuration. The integration operator replays provider events and reconciles queues. No operator deletes the source database, R2 bucket, Stripe events, or task queue during recovery.

Set a maintenance banner or feature flag before a destructive repair. Preserve the failing instance and logs. Use a new database instance for restore whenever possible; rollback is a connection/configuration change, not a destructive database overwrite.

## PostgreSQL backups and PITR

Production PostgreSQL must use a managed HA instance with:

- continuous WAL archiving and point-in-time recovery enabled;
- automated daily backups retained for at least 35 days;
- an additional weekly backup retained for the documented compliance period;
- encryption at rest with a managed key and least-privilege backup access;
- monitoring for backup age, WAL/archive lag, storage, replication, and failed backups;
- schema migration checksums and the migration ledger included in every backup.

Daily operator check:

1. Confirm the latest backup is successful and younger than 24 hours.
2. Confirm WAL/PITR retention covers the declared RPO and there is no archive lag.
3. Confirm the latest restore test succeeded and record the restore timestamp, release, migration version, and row/invariant checks.

PITR procedure:

1. Stop writes through the API feature flag or maintenance mode; keep public cached snapshots available if safe.
2. Select a recovery timestamp immediately before the incident or last known-good transaction.
3. Create a new managed instance from the backup/PITR target in the same approved region/network boundary.
4. Run migrations in verify-only mode; never run an unreviewed forward migration against a recovered copy.
5. Run health checks, referential-integrity checks, tenant-isolation checks, booking/inventory invariants, and outbox/job consistency checks.
6. Point the API and workers to the recovered instance using Secret Manager versioning, restart gradually, and monitor connection errors/latency.
7. Reconcile Stripe, Cloud Tasks, R2 metadata, calendar jobs, domains, and analytics before lifting maintenance mode.
8. Keep the original instance read-only and retained until the incident commander approves closure.

The local logical restore drill is available with `npm run db:restore:test`. It validates dump, restore, schema migration ledger, and basic integrity in a temporary database. It does not prove managed-provider PITR; run a staging managed-instance PITR drill at least quarterly.

## R2 recovery strategy

R2 is the authoritative media-object store after media cutover. Enable provider versioning or an equivalent immutable retention policy where supported, restrict delete permissions, and retain the migration/archive manifest containing object key, checksum, owner/site, variants, and CDN URL.

For accidental deletion or corruption:

1. Disable the affected delete/cleanup job kind with a feature flag.
2. Identify objects from the immutable manifest and R2 version/listing history.
3. Restore objects to the same stable key or a quarantined replacement key, preserving content type and cache metadata.
4. Restore PostgreSQL metadata from PITR or an explicit repair transaction, then verify ownership and public URLs.
5. Purge only affected CDN keys and repopulate through the media service.

For a complete R2 outage, keep public pages in a deterministic unavailable/placeholder state rather than exposing credentials or stale private URLs. Re-enable uploads only after signed upload, ownership, quota, processing, deletion, and public-rendering checks pass.

## Firebase Auth dependency failure

Firebase Auth remains the identity provider and is not locally restorable. On verification/API failure:

1. Do not accept unverified tokens or browser-supplied user IDs.
2. Continue serving cached public pages and public read-only content where safe.
3. Return a stable dependency-unavailable response for authenticated mutations; do not create bookings, orders, uploads, or billing changes without identity verification.
4. Preserve valid existing sessions only according to Firebase token expiry and server session policy; do not extend them during an outage.
5. Monitor Firebase status and token-verification failure rates, then run login, refresh, logout, ownership, and tenant-isolation smoke tests before reopening writes.

## Stripe webhook replay and reconciliation

The internal webhook ledger and idempotency keys are authoritative for processing history; Stripe remains the external event authority.

1. Stop automatic destructive payment/fulfillment repair jobs if event ordering is uncertain.
2. Confirm webhook signature validation and endpoint availability.
3. Replay failed events from the internal webhook ledger first. If absent, retrieve/replay the event from Stripe’s dashboard/API using the event ID.
4. Process each event through the adapter and internal state machine; duplicate delivery must be a no-op.
5. Reconcile customers, subscriptions, payment intents, refunds, and failed payments for the affected time window.
6. Re-enable fulfillment only after order/payment/inventory invariants pass.

Never set payment or subscription status from a client request or an unverified event payload.

## Cloud Tasks recovery

Cloud Tasks is durable but delivery is at-least-once. During an outage:

1. Inspect queue depth, oldest task age, retry counts, and dead-letter volume.
2. Confirm the worker revision, service identity/OIDC authentication, queue region, and dispatch URL.
3. Restore the worker or route traffic to the last known-good revision.
4. Run job reconciliation to release expired leases and enqueue missing outbox deliveries.
5. Replay dead-letter jobs only after checking idempotency keys and provider-side side effects.
6. Bound replay batches and monitor database locks, provider rate limits, and queue backlog.

Job handlers must remain safe to execute more than once. A task marked completed is terminal unless an explicit reconciliation repair creates a new idempotency key.

## Secrets and encryption-key rotation

1. Create a new Secret Manager version or KMS key version; do not overwrite the active version in place.
2. Grant runtime access, deploy a canary, and verify health, database, Stripe, Cloudflare, R2, OAuth, email, and task dispatch calls.
3. Rotate provider-side secrets where required: Stripe webhook secret, Cloudflare token, OAuth client secret, email key, and R2 keys.
4. Re-encrypt OAuth refresh tokens and other envelopes with the new KMS version in a bounded resumable job.
5. Retain the previous key/secret version for the defined decrypt grace period, then revoke it and confirm no logs or client bundles contain it.
6. Record the rotation, validation results, and revocation time in the audit log.

## Domain provider outage response

Cloudflare/domain operations are asynchronous and retryable. If Cloudflare or DNS verification is unavailable:

1. Stop new provisioning/verification attempts if they would increase provider load.
2. Continue showing the persisted domain state and DNS instructions; never represent provider failure as “no domains.”
3. Keep existing published routes serving through the last known-good routing configuration.
4. Back off verification/provisioning jobs, preserve idempotency keys, and send terminal failures only after bounded retries.
5. Reconcile DNS, certificate, and routing state after provider recovery; record any manual changes.

## Deployment rollback

Use `npm run deploy:rollback` with an explicit Cloud Run revision and `ROLLBACK_CONFIRM=I_UNDERSTAND`. Roll back worker first when a new worker is producing unsafe side effects, then API, then public web as needed. Keep backward-compatible database migrations and event versions; use a forward fix instead of destructive schema rollback. Verify health, auth, public rendering, task delivery, webhooks, booking/inventory invariants, and provider calls after rollback.

## Restoration test schedule

- Daily: automated backup/WAL/queue/provider health checks.
- Weekly: verify backup metadata, archive accessibility, and migration checksums.
- Monthly: local logical restore drill and staging application restore validation.
- Quarterly: managed PostgreSQL PITR to an isolated staging instance, R2 manifest/object recovery sample, Cloud Tasks dead-letter replay, Stripe webhook replay, and secrets rotation rehearsal.
- After every drill: record measured RPO/RTO, failures, corrective actions, and the next test date.

