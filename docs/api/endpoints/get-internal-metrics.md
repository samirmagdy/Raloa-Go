---
id: get-internal-metrics
method: GET
path: /internal/metrics
status: implemented
auth: api-key
source: server.ts
verified_by: test-observability.ts
updated: 2026-09-28
---

# `GET /internal/metrics`

Returns the process metrics registry in Prometheus text format. It is restricted to the background-job secret and is intended for private monitoring only.

The registry includes bounded counters and gauges for HTTP requests/errors, latency observations, PostgreSQL latency/errors, Cloud Task queue depth, job retries/failures/dead letters, provider failures, webhook failures, publishing failures, and booking conflicts.

It does not include request bodies, credentials, payment payloads, or personal data.
