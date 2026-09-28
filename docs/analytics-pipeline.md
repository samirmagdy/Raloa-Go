# Analytics pipeline

Analytics has five explicit boundaries:

1. **Ingestion** validates a versioned event, applies the public telemetry rate limit, and returns `202 Accepted` after enqueueing. It does not write rollups or call providers.
2. **Deduplication** uses the stable event ID as the Cloud Tasks idempotency key and the `(site_id, event_id)` PostgreSQL unique index as the final authority. Duplicate task delivery is safe.
3. **Asynchronous processing** is performed by the `analytics_rollup` worker. It may be retried or delivered more than once.
4. **Rollups** are updated in one PostgreSQL transaction with the short-lived raw-event buffer, daily summaries, visitor-day keys, dimensions, UTM values, and per-link metrics. A visitor is counted once per site/day through the visitor-day primary key.
5. **Studio queries** read only bounded, indexed PostgreSQL rollups. HTTP requests never scan or aggregate raw events. The maximum operational window is 400 days and every breakdown has a bounded result set.

## Storage ports

`AnalyticsRawEventStore` is the raw-event port. The current PostgreSQL implementation is a seven-day buffer used for retry/reconciliation. A future BigQuery adapter can implement the same port and receive the raw event without changing the ingestion contract, worker payload, or Studio query API. BigQuery is not used for synchronous Studio reads.

## Transaction boundary

For each worker event:

```text
BEGIN
  INSERT raw event ON CONFLICT (site_id, event_id) DO NOTHING
  if inserted:
    upsert daily summary
    insert visitor-day ON CONFLICT DO NOTHING
    increment unique visitor only when visitor-day was inserted
    upsert dimensions, UTM, and link rollups
COMMIT
```

External systems are not part of this transaction. Provider exports and warehouse delivery are asynchronous consumers and must be idempotent.

## Metric definitions

- `pageViews`: accepted `page_view` events.
- `uniqueVisitors`: distinct visitor hashes per site/day, summed over the requested bounded range.
- `clicks`: accepted `link_click` events.
- `CTR`: `clicks / pageViews * 100`, rounded to two decimals.
- `referrers`, `devices`, `browsers`, `countries`: page-view dimension rollups.
- `UTM`: source, medium, campaign, term, and content rollups for views and clicks.
- `per-link`: click totals keyed by the server-validated link ID.

Legacy Firestore rollups remain a compatibility read path only when PostgreSQL analytics is not enabled. Missing rollups return `ANALYTICS_ROLLUP_PENDING`; legacy raw-event aggregation is disabled.
