# Staging load test

This suite is intentionally opt-in. It creates bookings, checkout sessions, webhook deliveries, media objects, Studio writes, analytics events, and worker dispatches against disposable staging resources only.

Required environment:

```bash
LOAD_BASE_URL=https://staging.example.raloa.app
LOAD_BEARER_TOKEN=<staging Firebase ID token>
LOAD_PUBLIC_HANDLE=<disposable published handle>
LOAD_SITE_ID=<disposable owned site>
LOAD_PRODUCT_ID=<disposable in-stock product>
LOAD_SERVICE_ID=<disposable booking service>
LOAD_SLOT_START=<shared slot for contention test>
LOAD_JOB_IDS=<comma-separated pre-seeded idempotent job IDs>
LOAD_WORKER_URL=https://worker-staging.example.raloa.app/tasks/background-jobs
LOAD_STRIPE_WEBHOOK_BODY=<signed Stripe test event body>
LOAD_STRIPE_WEBHOOK_SIGNATURE=<matching Stripe test signature>
LOAD_DISPOSABLE_DATA_CONFIRMATION=I_UNDERSTAND
```

Run a controlled profile:

```bash
npm run load:staging
```

Override rates and duration with `LOAD_DURATION`, `LOAD_PUBLIC_RPS`, `LOAD_ANALYTICS_RPS`, `LOAD_WEBHOOK_RPS`, `LOAD_MEDIA_RPS`, and the workload-specific VU variables. Run the PostgreSQL/Cloud Tasks/Cloud Run collector in parallel:

```bash
npm run load:staging:observe
```

Set `LOAD_METRICS_URL` to the staging API’s protected `/internal/metrics` endpoint and `LOAD_METRICS_SECRET` to its staging-only operations secret. The collector stores the Prometheus snapshot without printing the secret. This captures request, job, provider, and PostgreSQL pool gauges (`postgres.pool.total`, `postgres.pool.idle`, `postgres.pool.waiting`, and `postgres.pool.max`) alongside direct database lock/connection observations.

The background-job scenario must run from a runner that can reach the internal worker URL (for example a staging VPC runner); it never makes the worker public. Pass/fail requires the k6 thresholds, no unexpected 5xx responses, no sustained PostgreSQL lock waits above 1 second, pool usage below 70%, queue oldest-task age below 60 seconds, and CPU/memory below the documented capacity limits. The collector writes a JSON report suitable for release evidence.
