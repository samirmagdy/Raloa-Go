# ADR-0007: Google Cloud Tasks as the durable job dispatcher

## Context

The platform has durable job records and worker handlers, but production
dispatch must provide scheduling, retries, and redelivery without making HTTP
requests wait for provider work.

## Decision

Use Google Cloud Tasks for targeted asynchronous work. Persist job state and
idempotency in the existing job repository, and dispatch deterministic HTTP
tasks to the worker service. Keep `BackgroundJobQueue` provider-independent so
local/test environments can use the in-process queue and Pub/Sub can coexist
for fan-out workflows.

## Configuration

Required production variables are `CLOUD_TASKS_PROJECT_ID`,
`CLOUD_TASKS_LOCATION`, `CLOUD_TASKS_QUEUE`, and `CLOUD_TASKS_WORKER_URL`.
Recommended variables are `CLOUD_TASKS_SERVICE_ACCOUNT` and
`CLOUD_TASKS_OIDC_AUDIENCE`.

## Reliability

The Cloud Tasks name is derived from the stable job ID, so duplicate enqueue
attempts are harmless. The persisted job row remains the source of execution
state; Cloud Tasks supplies delivery and scheduling. Workers claim a lease,
execute idempotent handlers, and record completion or bounded retry state.
Terminal failures become `dead_letter` and are exposed through the protected
status endpoint for monitoring and replay tooling.

## Alternatives

Pub/Sub is retained for fan-out workflows, but Cloud Tasks better matches
one-job/one-HTTP-worker execution, per-task scheduling, bounded retry, and
explicit task identity. The direct HTTP gateway is retained only as a strangler
compatibility path.

## Tradeoffs

Cloud Tasks adds GCP queue and IAM configuration, but provides targeted HTTP
delivery and scheduled execution. Firestore remains the current job-state store
during migration, so operational ownership is temporarily split between the
database and queue.

## Migration impact

Existing `BackgroundJobQueue` callers do not change. Production configuration
must add the Cloud Tasks project, location, queue, worker URL, and task
authentication. Local/test callers continue using the in-process queue.

## Reversal strategy

Switch the dispatcher configuration to the compatibility HTTP gateway or
Pub/Sub implementation. Persisted job IDs and idempotency keys remain valid, so
queued work can be redelivered through the replacement transport.
