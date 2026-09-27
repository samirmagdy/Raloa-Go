# ADR-0004: Cloud Tasks/Pub/Sub for durable background work

- Status: Accepted
- Date: 2026-09-27

## Context

Calendar sync, email, media processing, domain verification, OAuth refresh, analytics rollups, and provider reconciliation must survive request termination and duplicate delivery.

## Decision

Use Cloud Tasks for targeted, retryable HTTP work and Pub/Sub for fan-out/event delivery. Workers consume idempotent jobs recorded through the outbox and job-state repositories.

## Alternatives

Run work inside HTTP requests, use cron-only polling, or introduce a third-party queue immediately.

## Tradeoffs

Managed queues add delivery configuration, retry/DLQ operations, and eventual consistency, but provide durable retries, backoff, authentication, and independent worker scaling.

## Migration impact

Existing synchronous paths enqueue jobs, persist idempotency keys, expose job state, and retain compatibility handlers during rollout. Worker job kinds are feature-flagged where behavior changes.

## Reversal strategy

Pause or kill-switch a job kind, drain/replay its durable state, and temporarily invoke the legacy bounded handler. Never delete queued work to recover from a worker release.
