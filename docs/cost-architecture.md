# Infrastructure cost architecture

This is an illustrative unit-economics model for the 12-month planning workload in [capacity-plan.md](capacity-plan.md). Prices are budgeting assumptions, not provider quotes; update the rate card quarterly and record the date, region, currency, and committed-use discounts used.

## Planning case and monthly cost envelope

The model uses 30,000 active creators, 30 million public page views, 100 million analytics events, 150,000 bookings, 75,000 checkouts, 150,000 uploads, 11 TB retained media, and 15 TB CDN delivery per month.

| Cost pool | Monthly assumption | Allocation basis |
| --- | ---: | --- |
| Public/API/worker compute | $650 | Requests, jobs, and processing time |
| PostgreSQL, backups, and connections | $550 | Fixed instance plus storage/backup headroom |
| Firestore compatibility/editor workload | $250 | Document reads/writes and realtime usage |
| Cloud Tasks/Pub/Sub | $120 | 1.5 million job/event deliveries |
| Object storage and media processing | $350 | 11 TB retained objects plus transforms |
| CDN and network egress | $900 | 15 TB delivered assets/pages |
| Analytics ingestion, storage, and queries | $350 | 100 million events and bounded dashboard queries |
| Auth, email, observability, and provider operations | $400 | Account, email, monitoring, domain/calendar operations |
| **Estimated platform total** | **$3,570/month** | Excludes payment volume fees and creator support |

The planning case therefore has an infrastructure cost of approximately **$0.12 per active creator-month** before payment processing. This is a blended planning figure; a small creator with no traffic costs less than a high-traffic creator with media and analytics usage.

## Unit economics

| Unit | Approximate cost | Calculation |
| --- | ---: | --- |
| Active creator-month | **$0.12** | $3,570 / 30,000 creators |
| 1,000 public page views | **$0.03** | $900 CDN/network pool / 30,000 units |
| 1,000 analytics events | **$0.004** | $350 analytics pool / 100,000 units |
| 1 GB retained media | **$0.03/GB-month** | $350 media pool / 11,000 GB, including processing/headroom |
| 1 GB delivered | **$0.06** | $900 CDN/network pool / 15,000 GB |
| Booking | **$0.002** | $300 of transactional/workflow allocation / 150,000 bookings |
| Email | **$0.0007** | $300 email allocation / 450,000 messages |
| Active custom domain | **$0.02/domain-month** | $200 domain-operation allocation / 10,000 domains |
| Domain operation | **$0.007** | $200 allocation / 30,000 verification/repair operations |
| Checkout infrastructure | **$0.01/checkout** | $750 checkout/order allocation / 75,000 checkouts |
| Checkout payment processing | **provider rate + fixed fee** | Illustrative Stripe model: 2.9% of payment value + $0.30; a $50 checkout costs about $1.75 in payment fees before platform infrastructure |

The booking and checkout infrastructure figures exclude email, calendar, and payment-provider charges already represented in their own rows. Provider fees should be modeled separately from platform gross margin because they scale with GMV rather than request count.

## Cost alerts

Create monthly budget alerts at 70%, 85%, and 100% of the approved platform budget. Alert on the following usage and unit-cost thresholds:

- blended infrastructure cost above $0.15 per active creator-month;
- CDN/network above $0.08 per GB delivered or cache hit rate below 90%;
- analytics above $0.006 per 1,000 events, query scans above the dashboard budget, or ingestion lag above 5 minutes;
- media above $0.04 per retained GB-month, orphaned assets above 1%, or processing retries above 2%;
- Firestore reads/writes growing faster than active creators because of unbounded client listeners or uncached public reads;
- PostgreSQL above 70% connection utilization, storage growth above the capacity model, or read replicas added without a measured latency case;
- queue delivery and retry spend above $0.01 per job or dead-letter volume above zero;
- email above $0.001 per message or bounce/complaint rates causing provider-tier penalties;
- domain provider operations above $0.01 per operation;
- payment processing and refunds exceeding the modeled percentage of GMV.

Budget alerts should include tenant/site dimensions where the provider supports labels or application usage records. A single creator generating disproportionate media, bandwidth, analytics, or email usage should be visible before the blended average hides it.

## Disproportionate adoption risks

1. **Media delivery and CDN egress.** Public page traffic is inexpensive while large images and video variants scale with bytes, not page count. Enforce image limits, responsive variants, CDN caching, and lifecycle deletion before adding origin capacity.
2. **Analytics retention and queries.** Raw events grow with every visitor and retention period. Keep raw history in analytical storage, partition it, deduplicate it, and serve dashboards from bounded rollups rather than scanning history.
3. **Firestore compatibility reads.** Temporary dual reads/listeners can scale by document operation count and become expensive during migration. Use feature flags, cache published data, and retire migration-only listeners after equivalence evidence.
4. **Payment processing.** Checkout fees scale with GMV and fixed fees punish low-value orders. Model provider fees separately, batch operational work, and avoid treating payment fees as infrastructure savings opportunities.
5. **Email and provider retries.** Failed integrations can multiply email, webhook, and API calls through retries. Use idempotency, bounded backoff, dead-letter queues, and provider-specific budgets.
6. **PostgreSQL step changes.** Transactional storage is relatively predictable until connection pressure, backups, replicas, or IOPS force a larger managed tier. Pool connections and scale on measured lock/latency metrics.

## Cost controls by architecture

- Keep public rendering cacheable and separate from Studio so visitor growth does not scale authenticated application compute.
- Use background jobs for provider calls and media processing so retries are bounded and observable.
- Store only operational analytics rollups in PostgreSQL; use analytical storage for raw history.
- Keep repository and adapter boundaries so storage, queue, CDN, and provider choices can be changed without rewriting domain logic.
- Review this model quarterly against invoices and usage exports. Record the observed unit cost, revised assumption, budget impact, and reversal plan for each change.
