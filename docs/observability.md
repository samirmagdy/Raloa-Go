# Production observability

Observability is a platform boundary, not ad hoc `console.log` output. The server observability
implementation is under `server/infrastructure/observability` and emits JSON logs, request metrics,
trace correlation, and optional Sentry exception events.

## Correlation and safety

Every request gets or propagates `X-Request-ID`. W3C `traceparent` and Google Cloud trace headers are
recognized and emitted as `traceId`. Logs may include safe `userId`, `tenantId`, `siteId`, `jobId`,
`webhookId`, and provider labels when available. Authorization headers, cookies, tokens, passwords,
credentials, raw payloads, and event bodies are redacted or excluded. Request IDs are returned to
clients for support correlation.

## Required signals

- `http.requests`, `http.duration_ms`, and `http.errors`, labelled by route/method/status;
- job enqueue, completion, retry/failure, and dead-letter counts by job kind;
- webhook received, processed, duplicate, and failed counts by provider/event class;
- external-provider latency and failure counters for Stripe, Cloudflare, Firebase, Google, Microsoft,
  email, storage, and analytical ingestion;
- cache hit/miss, rate-limit rejection, database transaction retry/failure, and outbox lag;
- frontend JavaScript exceptions and Web Vitals, correlated by release/environment where available.

The current in-process metrics collector is a test/development adapter. Production wiring should
export the same names and labels to Cloud Monitoring/OpenTelemetry, Prometheus, or an equivalent
backend. Metrics must use bounded route/provider/status labels and never raw IDs as unbounded label
cardinality.

Set `SENTRY_DSN` for backend exception tracking and `VITE_SENTRY_DSN` for authenticated Studio
frontend tracking. Sentry initialization is optional, release/environment-aware, and does not alter
local behavior when DSNs are absent. Public-page loading keeps the Sentry module out of its initial
entry path to preserve the public performance boundary.
