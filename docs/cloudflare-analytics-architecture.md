# Cloudflare analytics and jobs

## Applied staging foundation

- `raloa-staging-analytics` is the separate R2 bucket for raw analytics events.
- `raloa-staging-jobs` and `raloa-staging-jobs-dlq` are the queue and dead-letter queue.
- `apps/workers/cloudflare/index.ts` validates analytics events, stores immutable raw event objects, and consumes job messages.
- PostgreSQL remains the authoritative source for transactional state and bounded Studio rollups.
- The Worker is deployed as `raloa-staging-jobs-consumer`; its `raloa-staging-jobs` consumer and DLQ are active.

## Data flow

```text
public telemetry -> API validation -> Cloudflare Queue -> Worker
                                        |              |
                                        |              +-> PostgreSQL rollups
                                        +-> R2 raw events
                                                   |
                                  R2 Data Catalog / Iceberg tables
                                                   |
                                            R2 SQL bounded analysis
```

The Worker writes one immutable object per event. A later compaction job should convert partitioned raw objects into Iceberg tables through the R2 Data Catalog. R2 SQL is a bounded query engine over catalog tables; it is not a replacement for PostgreSQL transactions or dashboard serving.

## Deliberate non-cutover

The existing Google Cloud Tasks dispatcher remains available until the Cloudflare Worker is deployed, receives staging traffic, passes retry/DLQ/idempotency tests, and is selected through a controlled deployment change (`JOB_TRANSPORT=cloudflare`, then `CLOUDFLARE_QUEUE_ENABLED=true`). No production job transport is switched by this foundation change.

R2 Data Catalog and R2 SQL are not enabled by source code alone. The catalog must be created for the analytics bucket in the Cloudflare dashboard, then the Iceberg table/warehouse identifiers must be added to deployment secrets. Until then, raw R2 storage and PostgreSQL rollups are usable independently.

## Required follow-up

1. Create an R2 Data Catalog on `raloa-staging-analytics`.
2. Create an Iceberg raw-event table with the documented schema and partition specification.
3. Configure the catalog token as a worker/server secret; never commit it.
4. Deploy the Worker with Wrangler and run queue, retry, DLQ, and analytics smoke tests.
5. Add a compaction worker that writes Iceberg data and retains raw objects according to the retention policy.

## Cloudflare account setup still required

The first visit to the account's Workers landing page must register a `workers.dev` subdomain:

`https://dash.cloudflare.com/0a390c43f09e75fecd4d9b42e9ec5426/workers`

After that one-time action, run:

```sh
npx wrangler deploy --config apps/workers/wrangler.cloudflare.jsonc
npx wrangler queues consumer list raloa-staging-jobs
```

Then set the Worker secrets/variables through Wrangler or the dashboard:

```sh
npx wrangler secret put INTERNAL_WORKER_TOKEN --config apps/workers/wrangler.cloudflare.jsonc
```

`APPLICATION_WORKER_URL` must point to the non-production application worker endpoint before non-analytics jobs are enabled. Do not use an empty value for a live cutover.
