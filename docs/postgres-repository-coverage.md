# PostgreSQL repository coverage review

This is a static coverage review. It does not claim live equivalence without database credentials and reconciliation reports.

| Firestore repository/factory | PostgreSQL equivalent | Missing behavior or difference | Existing proof |
| --- | --- | --- | --- |
| `createFirestoreSitesRepository` | `createPostgresSitePersistenceRepository`, `sites-repository.ts` | PostgreSQL site repository needs complete profile projection, slug redirects, membership-aware listing, and all autosave conflict semantics | site migration/schema tests; no live equivalence |
| `createFirestoreBookingsRepository` | `bookings-repository.ts` | Firestore booking locks/legacy IDs/calendar job fields require PostgreSQL slot transaction and outbox integration | booking migration/schema tests; concurrency skipped without PG |
| `createFirestoreOrdersRepository` | `commerce-service.ts`, `commerce-repositories.ts` | State history, fulfillment, payment-event replay and customer order pagination must cover every legacy status | state-machine/commerce tests; concurrency skipped |
| `createFirestoreProductsRepository` | `commerce-repositories.ts`, `commerce-service.ts` | Variant/price/inventory projection must be reconciled against legacy product payloads | commerce migration tests |
| `createFirestorePaymentsRepository` | `payment-service.ts`, commerce payment tables | Provider event mapping and refunds need complete legacy event reconciliation | payment-domain tests; no real Stripe replay |
| `createFirestoreFulfillmentsRepository` | `commerce-service.ts` and `fulfillment_history` | Legacy fulfillment documents need a deterministic history mapping | order state tests; no full dataset evidence |
| `createFirestoreInventoryRepository` | `commerce-service.ts` and inventory tables | Movement/release semantics require row-lock concurrency proof | commerce concurrency test exists but was skipped |
| `createFirestoreSubscriptionsRepository` | billing payment service/subscription tables | Billing customer, entitlement, renewal, cancellation and history projection incomplete | billing/entitlement tests |
| `createFirestoreIntegrationsRepository` | `oauth-repository.ts` and integration tables | Provider connection state, scopes, encrypted tokens and reconnect state need full mapping | OAuth tests; no provider staging evidence |
| `createFirestoreOAuthRepository` | `oauth-repository.ts` | Refresh locks/rotation/revocation must be proven against all legacy connections | OAuth service tests |
| `createFirestoreAudienceRepository` | `audience-repository.ts` | Legacy IDs/tags/consent/source mapping and exact aggregate count semantics need reconciliation | audience tests |
| `createFirestoreAnalyticsRollupsRepository` | `analytics-repository.ts` | Raw event history and dimensions need semantic comparison; Firestore visitor-day model differs from PostgreSQL rollups | analytics tests |
| `createFirestoreBillingRepository` | billing customer/subscription/payment repositories | Current server still uses Firestore billing authority in composition | billing tests |
| `createFirestoreDomainsRepository` | `domains-repository.ts`, domain service | Verification/provider operation history and ownership mapping need reconciliation | domain tests |
| `createFirestoreMediaMetadataRepository` | `media-repository.ts` | Fixed limits (`500`, `10,000`) need cursor/batch APIs; variant/ownership parity requires manifest comparison | media tests |
| `createFirestoreBackgroundJobRepository` | PostgreSQL `operational_jobs` repository (not fully wired) | Claim lease, retry, dead-letter, status lookup and reconciliation must replace Firestore job store | job service tests, no authority proof |
| `createFirestoreTransactionalOutbox` / `createFirestoreOutboxRepository` | `outbox-repository.ts` | All state changes must write PostgreSQL outbox atomically; consumers need replay/idempotency parity | outbox tests |
| `createFirestoreAuditRepository` | No sole PostgreSQL audit service wired in composition | Append-only audit writes and query/export behavior need implementation/wiring | audit tests cover contracts only |
| `createFirestoreFeatureFlagRepository` | No authoritative PostgreSQL feature-flag repository wired in composition | Persisted flag schema does not yet match all rollout/tenant fields in the service contract | feature-flag tests use memory/Firestore paths |
| `createFirestoreEmailDeliveryWorker` | PostgreSQL jobs + email adapter | Notification job and booking lookup must move to PostgreSQL | background-job tests |
| `createCalendarSyncWorker` Firestore dependencies | PostgreSQL calendar state/integration/job tables | Calendar job reconciliation and token lookup still read Firestore | calendar tests |
| `createDomainVerificationWorker` Firestore dependencies | PostgreSQL domains + jobs | Pending-domain query and provider state transitions still read Firestore | domain tests |

## Repository work that is safe without credentials

Completed/prepared in this phase:

- shared migration comparison and ownership/semantic difference reporting;
- deterministic R2 object-key helper;
- paginated R2 object listing;
- dry-run migration orchestration;
- fixture-based media reconciliation;
- controlled signed approval validation;
- file-by-file replacement plans.

Still blocked on credentials/data:

- live row-count, ownership, referential-integrity, and semantic reconciliation;
- production repository cutover;
- archive export and verification against Firestore;
- R2 object inventory and URL verification;
- concurrency tests against a real PostgreSQL test database.

