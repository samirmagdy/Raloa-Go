# Analytics architecture

Analytics has two separate workloads and storage lanes:

1. **Operational analytics**: bounded daily aggregates and visitor-day facts required by Studio.
   PostgreSQL owns these tables because they are small, relational, and queried alongside site
   ownership and permissions.
2. **Analytical history**: high-volume append-only page views, link clicks, dimensions, and event
   payloads. BigQuery (or an equivalent partitioned analytical store) owns this history. It is not
   an unlimited table in the transactional PostgreSQL database.

## Data flow

```text
public event
  -> validated event envelope + stable event_id
  -> analytical ingestion (BigQuery partitioned raw_events)
  -> scheduled rollup job
  -> PostgreSQL analytics_daily_rollups / analytics_visitor_days
  -> Studio API
```

The raw event path is append-only and idempotent on `event_id`. Rollup workers process a bounded
time window, use a watermark/checkpoint, and upsert PostgreSQL aggregates by their natural keys.
They must be replayable: rerunning a window produces the same aggregate rather than double-counting.
Operational tables must not contain arbitrary raw payloads or unbounded dimensions.

## PostgreSQL rules

`analytics_daily_rollups` and `analytics_visitor_days` are operational read models with explicit
retention and indexes. A PostgreSQL `analytics_events` table, if enabled during migration, is only a
short-lived ingestion buffer with a TTL cleanup job and an `event_id` uniqueness constraint. It is
not a source for unlimited historical reporting.

Analytics writes do not extend booking, order, payment, or subscription transactions. The domain
transaction emits an event/outbox record where required; an analytics worker exports or aggregates
after commit. Analytics failure must not roll back the business operation.

## Privacy and operations

- Validate and minimize event payloads before export; visitor identifiers are hashed or pseudonymous.
- Partition raw history by event date and cluster by site/event type where supported.
- Apply retention and deletion workflows in both analytical storage and operational rollups.
- Monitor ingestion lag, rejected events, duplicate rate, rollup watermark, export failures, and
  dead-letter volume.
- Backfill rollups from raw history; never reconstruct transactional order or booking state from
  analytics events.

The authoritative lane assignments and retention policy are in
[`server/infrastructure/analytics/storage-policy.ts`](../server/infrastructure/analytics/storage-policy.ts).
