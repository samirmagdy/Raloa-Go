# Performance budgets

Budgets are enforced before release artifacts are promoted:

| Surface | Budget | Check |
|---|---:|---|
| Next.js largest JavaScript chunk | 800 KiB | `npm run check:performance:next` |
| Next.js total JavaScript chunks | 3 MiB | `npm run check:performance:next` |
| Vite Studio chunk | 350 KiB | `npm run check:performance` |
| Firebase vendor chunk | 650 KiB | `npm run check:performance` |
| Public page p95 under staged load | 800 ms | `k6` `public_page_latency` |
| API write p95 under staged load | 1,200 ms | `k6` booking/inventory metrics |
| Analytics ingestion p95 | 500 ms | `k6` `analytics_ingestion_latency` |
| Media upload p95 | 2,500 ms | `k6` `media_upload_latency` |
| HTTP/error rate | <2% | `k6` `load_errors` and `http_req_failed` |
| PostgreSQL pool utilization | <70% | `load:staging:observe` |
| PostgreSQL lock wait | <1 s sustained | `load:staging:observe` |
| Cloud Tasks oldest pending age | <60 s | `load:staging:observe` |

Run the Next.js build before its budget check:

```sh
npm --prefix apps/web run build
npm run check:performance:next
```

Public pages are server-rendered and ship no Studio client bundle. Published snapshots are cached for five minutes with publication/domain tags, images are delivered through Next image optimization using AVIF/WebP and CDN cache headers, and embeds use native lazy loading. Studio settings are loaded only when the Settings tab is opened.

PostgreSQL latency is instrumented by operation and success/error status. Collection reads use explicit limits or cursor pagination; media variant loading is batched to avoid per-asset queries. Use `EXPLAIN (ANALYZE, BUFFERS)` against staging for slow-query investigation before adding a new index.

The staged load profile and observation commands are documented in [`load/k6/README.md`](../load/k6/README.md). A performance bottleneck is a launch blocker when any latency/error threshold fails, connection saturation exceeds 70%, lock waits remain above one second, or queue backlog grows throughout the test window.
