# Capacity plan

This plan sizes the current modular monolith and its managed dependencies for a realistic 12-month growth case. It is a planning baseline, not an internet-scale target. Actual production metrics replace assumptions during quarterly review.

## Workload assumptions

| Metric | Current baseline | 12-month planning case | Derivation |
| --- | ---: | ---: | --- |
| Creator accounts | 10,000 | 30,000 | 3x account growth |
| Sites | 15,000 | 45,000 | 1.5 sites/creator |
| Published sites | 10,000 | 30,000 | 67% publish rate |
| Monthly unique visitors | 1,000,000 | 3,000,000 | 100 visitors/published site/month |
| Public page requests/month | 8,000,000 | 30,000,000 | 10 requests/visitor plus crawlers |
| Analytics events/month | 25,000,000 | 100,000,000 | 3.3 events/page plus client/server events |
| Bookings/month | 50,000 | 150,000 | 5% of published sites transact monthly |
| Orders/month | 25,000 | 75,000 | 2.5% of published sites transact monthly |
| Uploads/month | 50,000 | 150,000 | 5 uploads/published site/month |
| Average original upload | 2 MB | 2 MB | Images and small creator assets |
| Active custom domains | 3,000 | 10,000 | 33% of published sites |
| Domain operations/month | 10,000 | 30,000 | Verification, renewal, and repair attempts |
| Provider webhooks/month | 100,000 | 300,000 | Stripe, auth, domain, and calendar events |

The planning case is approximately 3x the current baseline. It does not assume viral traffic, billions of events, or a globally distributed transactional database. A traffic spike is handled by CDN caching and queues; it is not treated as a reason to pre-provision every dependency at hypothetical maximum scale.

## Derived peak load

For monthly workloads, the planning model uses 2.63 million seconds/month, a 10x public/API peak over average, and a 4x asynchronous peak over average:

| Workload | Planning average | Planning peak budget |
| --- | ---: | ---: |
| Public page requests | 11.4 requests/sec | 115 requests/sec at the edge |
| Public origin requests at 95% CDN hit rate | 0.6 requests/sec | 6 requests/sec |
| Analytics ingestion | 38 events/sec | 150 events/sec |
| Bookings + orders | 0.085 transactions/sec | 1 transaction/sec |
| Provider webhooks | 0.11 events/sec | 2 events/sec |
| Background jobs | 1.0 jobs/sec | 4 jobs/sec sustained, 20 jobs/sec burst |

Public pages are the dominant read workload. A 95% CDN hit rate keeps the origin independent of most visitor volume. Booking/order writes remain small but require strong transactional guarantees, so capacity is sized for lock contention and burst behavior rather than average throughput alone.

## Initial capacity targets

### PostgreSQL

- Start with a managed PostgreSQL instance at 4 vCPU, 16 GB RAM, and 500 GB SSD, with automated backups and point-in-time recovery.
- Reserve 100 pooled application connections: 60 for API instances, 20 for workers, and 20 for migrations/operations. Keep per-process pools below the limit; do not let autoscaling create unbounded database connections.
- Provision 2x the measured 95th-percentile write/read IOPS and 30% free storage after the first backfill. Add a read replica only when read latency or primary CPU demonstrates the need; transactional writes remain on the primary.
- Alert at 60% storage, 65% sustained CPU, 70% connection utilization, lock waits above 1 second, and transaction p95 above 500 ms.

PostgreSQL owns bookings, availability, orders, inventory, subscriptions, integrations, domains, and bounded Studio rollups. Raw analytics history does not accumulate there.

### Queues and workers

- Cloud Tasks handles targeted jobs at a configured dispatch ceiling of 50 requests/sec per queue with exponential backoff and dead-letter queues.
- Pub/Sub handles analytics and fan-out events at 250 messages/sec provisioned headroom, above the 150 events/sec planning peak.
- Start with 2 worker instances minimum during business hours and autoscale to 20, with concurrency 1 for provider/transaction-sensitive jobs and bounded concurrency for media processing.
- Alert when oldest pending job age exceeds 60 seconds, retry rate exceeds 2%, or the dead-letter queue receives any production message.

Every job remains idempotent and checkpointed. Queue capacity is increased from observed backlog and handler duration, not from request volume alone.

### Media storage and CDN

- Planning uploads produce 300 GB of new originals/month. With two processed variants and 12 months of retention, reserve approximately 11 TB object capacity including 30% headroom.
- Store originals and variants in Firebase Storage or R2 behind the media adapter; serve cacheable public variants through the CDN.
- Target 95%+ cache hit rate for published page payloads and 85%+ for repeated media variants.
- Use lifecycle rules for abandoned uploads, temporary processing objects, and deleted-site retention. Alert on orphaned assets above 1% of monthly uploads and media processing age above 10 minutes.

### Analytics

- The planning case produces 1.2 billion raw events/year. At an average 1 KB compressed event, reserve roughly 1.2 TB/year before analytical table/partition overhead.
- Partition raw events by event date and cluster by tenant/site. Retain raw history in BigQuery or equivalent; keep only bounded creator-facing rollups in PostgreSQL.
- Provision ingestion for 150 events/sec peak with deduplication on event ID and at least 24 hours of retry/replay buffer.
- Alert when ingestion lag exceeds 5 minutes, duplicate rate exceeds 1%, or rollup freshness exceeds 15 minutes.

### Public web and API

- Cloud CDN absorbs public read bursts. The public role starts at min 1/max 20 instances; the authenticated API starts at min 1/max 30, subject to measured CPU, memory, and latency.
- Target public origin p95 under 300 ms for cache misses and API p95 under 500 ms for ordinary authenticated reads. Booking/order writes have a separate p95 target under 1 second excluding provider calls.
- Keep public rendering independent of the Studio JavaScript bundle. Do not scale the API based on cacheable public traffic.

### Provider and webhook volume

- Stripe, Firebase Auth, Cloudflare, calendar, email, and storage adapters are tested for 2 events/sec sustained planning peak and 10 events/sec burst.
- Webhook consumers persist provider event IDs before applying state changes, expose provider failure-rate metrics, and retry through the worker platform.
- Alert when provider error rate exceeds 2% over 5 minutes, signature failures spike, or reconciliation age exceeds 15 minutes.

## Scaling triggers and review

Review this model quarterly and after any sustained 30-day threshold breach. Revisit architecture when one of these occurs:

- public origin traffic exceeds 6 requests/sec sustained or CDN hit rate falls below 90%;
- PostgreSQL exceeds 65% CPU, 70% connections, or 500 ms transaction p95;
- analytics exceeds 150 events/sec peak or 5-minute ingestion lag;
- queue backlog remains above 10 minutes despite 20 workers;
- media storage exceeds 11 TB or processing failure rate exceeds 2%;
- a domain needs independent scaling, security, deployment, or operational ownership.

Until a trigger is evidenced, keep the modular monolith, repository boundaries, worker platform, and managed services. Capacity changes should be recorded with the measured metric, new assumption, cost impact, and reversal plan.
