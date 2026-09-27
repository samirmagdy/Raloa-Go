# Durable background jobs

HTTP handlers enqueue work and return without calling providers. Jobs are
deduplicated by `(kind, idempotencyKey)`, persisted in Firestore
(`background_jobs`), and represented in PostgreSQL by `operational_jobs` for the
database migration path.

`createConfiguredDispatcher()` selects Cloud Tasks when
`CLOUD_TASKS_DISPATCH_URL` is configured, otherwise Pub/Sub when
`PUBSUB_DISPATCH_URL` is configured. Both transports deliver `{ jobId }` to
`POST /internal/background-jobs/run`, protected by `BACKGROUND_JOB_SECRET`.

Handlers claim a five-minute lease before executing. Successful work becomes
`completed`; failures use exponential backoff until `maxAttempts`, then become
`dead_letter`. Re-delivery is safe because the repository claim and job
idempotency key prevent duplicate execution. Provider calls belong inside job
handlers, never in request lifecycles.

`POST /internal/background-jobs/reconcile` is a protected repair operation for
expired leases and pending redeliveries. It can be invoked by Cloud Scheduler
or an operations runbook. `POST /internal/background-jobs/run` is safe to call
more than once: completed and dead-lettered jobs are terminal, and active jobs
require a transactional lease claim.

Supported job kinds are calendar synchronization, email delivery, domain
verification, OAuth refresh, analytics rollups, media processing, Stripe
reconciliation, order processing, and cleanup. Operational dashboards should monitor processing
latency, retry counts, dead-letter counts, and lease expiry by kind.
