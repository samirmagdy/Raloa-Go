# Raloa system baseline

**Baseline date:** 2026-09-27  
**Scope:** current working tree and current runtime architecture  
**Purpose:** establish a behavior-preserving reference before further architectural replacement or datastore cutover.

## Executive summary

Raloa is currently a Vite/React authenticated Studio plus a Vite public-profile renderer, backed by a large Express application in [`server.ts`](../../server.ts). Firestore remains the effective operational datastore for most domains. PostgreSQL schemas, repositories, migration tooling, outbox, workers, provider adapters, authorization policies, and shared schemas exist, but they are migration seams rather than a complete replacement of the legacy request paths.

The primary architectural risk is not a missing module; it is mixed ownership. [`server.ts`](../../server.ts) still combines transport, authentication, authorization, Firestore queries, Stripe calls, media processing, analytics writes, domain provisioning, and response shaping. The safest next step is an evidence-driven strangler migration behind the existing contracts, beginning with route/persistence boundary cleanup and explicit regression fixtures.

This document intentionally records the current state only. It does not change application behavior.

## Current topology

```text
Cloudflare DNS/CDN/custom domains
              |
      Express + Vite serving layer
       /                    \
Public profile renderer       React/Vite Studio
       |                       |
   public Firestore reads   Firebase Auth + API calls
              \             /
               Express API in server.ts
                 |
       Firestore is authoritative today
                 |
       Stripe / Cloudflare / Calendar / Resend
                 |
       Firestore jobs, outbox, worker.ts

PostgreSQL, adapters, jobs, events, shared schemas, and migration
packages are present as controlled migration infrastructure; they are
not yet the universal production source of truth.
```

The requested target topology (Next.js public web, React/Vite Studio, modular API, PostgreSQL transactional domains, Firestore editor/config, outbox, Cloud Tasks/Pub/Sub workers, BigQuery/raw analytics, and R2/Firebase media) is directionally represented in the repository, but the running system is still a modularizing monolith with legacy Firestore paths.

## Frontend route map

Frontend entry selection is in [`src/main.tsx`](../../src/main.tsx). The route state and Studio/public branches are primarily in [`src/App.tsx`](../../src/App.tsx) and [`src/PublicPageApp.tsx`](../../src/PublicPageApp.tsx).

| Route or branch | Runtime | Behavior | Status |
|---|---|---|---|
| `/`, `/features`, `/pricing`, `/guides`, `/about`, `/contact` | Vite/React | marketing/home sections | partially implemented; client-side route state |
| `/templates` | Vite/React | template gallery and template selection | partially implemented |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Vite/React | auth modal/flow | partially implemented; depends on Firebase/server auth config |
| `/studio`, `/studio/*` | Vite/React | authenticated creator administration | partially implemented; broad surface, API dependent |
| `/@handle` | Vite/React public renderer | published creator page; server also handles metadata/SSR-like response | migration-risk; not Next.js yet |
| `/public-render/:handle` | Vite/React public renderer | public rendering/test boundary | migration-risk |
| custom host/root | Express host middleware + Vite/public renderer | custom-domain resolution and public page | migration-risk; provider and Firestore dependent |
| invalid client route | Vite/React | 404 state | present |

The browser warning reported during the audit (form control without `id`/`name`) is a frontend accessibility/autofill issue and is not part of the backend behavior baseline. It should be tracked separately from this architecture baseline.

## API and Express route inventory

The route scan found **94 routes**, including **9 operational/worker routes** that are not currently represented in the OpenAPI/contract inventory. The main registration surface is [`server.ts`](../../server.ts); modular controllers also exist in [`server/http/controllers`](../../server/http/controllers).

### Public, authentication, account, and SEO routes

| Domain | Routes |
|---|---|
| Health/config | `GET /api/health`, `GET /api/readiness`, `GET /health` (worker) |
| SEO/public metadata | `GET /robots.txt`, `GET /llms.txt`, `GET /sitemap.xml`, `GET /api/public/sites/:handle` |
| Handle/slug | `GET /api/v1/handles/check`, `POST /api/v1/handles/reserve` |
| Auth | `POST /api/v1/auth/register`, `/login`, `/logout`, `/forgot-password`, `/reset-password`, `/oauth/google`, `/oauth/apple`, `/verify-email`; `GET/POST /api/v1/auth/session` |
| Sessions | `GET /api/account/sessions`, `DELETE /api/account/sessions/:sessionId`, `POST /api/account/sessions/revoke-all` |
| Account | `GET/PUT /api/account/profile`, `GET/PUT /api/account/preferences`, `GET /api/account/billing`, `/billing/details`, `/referrals`, `/export`; `POST /api/account/delete-request` |
| Public forms | `POST /api/v1/public/newsletter`, `POST /api/v1/public/contact` |

### Sites, publishing, audience, analytics, and bookings

| Domain | Routes |
|---|---|
| Sites | `GET/POST /api/sites`, `DELETE/PUT /api/sites/:siteId` |
| Scheduling/public booking | `GET /api/v1/public/scheduling/:handle/config`, `GET /api/v1/public/scheduling/:handle/availability`, `POST /api/v1/public/bookings` |
| Creator bookings | `GET /api/creator/bookings`, `POST /api/creator/bookings/:bookingId/confirm`, `POST /api/creator/bookings/:bookingId/cancel` |
| Audience | `GET /api/creator/audience`, `POST /api/creator/audience/subscribers`, `PATCH/DELETE /api/creator/audience/:kind/:id`, `GET /api/creator/audience/export` |
| Analytics | `POST /api/v1/public/telemetry/page-view`, `POST /api/v1/public/telemetry/link-click`, `GET /api/analytics/platform` |

### Media, products, orders, and billing

| Domain | Routes |
|---|---|
| Media | `POST /api/media/upload`, `GET /api/media`, `GET /api/media/:mediaId/url`, `DELETE /api/media/:mediaId`, `POST /api/media/cleanup`, `GET /api/media/public/:mediaId` |
| Products | `GET/POST /api/creator/products`, `PATCH/DELETE /api/creator/products/:productId`, `GET /api/v1/public/products/:handle`, `POST /api/v1/public/products/:handle/checkout` |
| Orders | `GET /api/account/orders`, `GET /api/creator/orders`, `PATCH /api/creator/orders/:orderId/fulfillment` |
| Billing | `POST /api/billing/activate-free`, `POST /api/billing/checkout-session`, `POST /api/billing/portal-session`, `GET /api/billing/checkout-session` |
| Referral | `POST /api/v1/referrals/qualify` |
| Stripe webhook | `POST /api/webhooks/stripe` |

### Integrations, domains, and operational routes

| Domain | Routes |
|---|---|
| Social integrations | `GET /api/integrations/providers`, `GET /api/integrations`, `GET /api/integrations/github/start`, `GET /api/integrations/github/callback`, `POST /api/integrations/:provider/refresh`, `DELETE /api/integrations/:provider` |
| Calendars | `GET /api/calendar/integrations`, `GET /api/calendar/:provider/start`, `GET /api/calendar/:provider/callback`, `DELETE /api/calendar/:provider` |
| Domains | `GET /api/domains`, `POST /api/domains/provision`, `POST /api/domains/verify`, `DELETE /api/domains/:domainId` |
| Background jobs | `POST /internal/background-jobs/run`, `POST /internal/background-jobs/reconcile` |
| Calendar/domain reconciliation | `POST /internal/calendar-jobs/reconcile`, `POST /internal/domain-verification/reconcile` |
| Outbox | `POST /internal/outbox/publish`, `POST /internal/outbox/cleanup` |
| Worker service | `POST /tasks/background-jobs`, `POST /tasks/outbox-publish` |

### API contract baseline

[`docs/api/openapi.yaml`](../api/openapi.yaml) contains 85 operations and 85 endpoint documents exist under [`docs/api`](../api). The contract checker scanned 94 runtime routes and failed because the 9 operational/worker routes above are undocumented. It also reports 46 pending endpoint documents. This is a contract completeness failure, not evidence that the documented routes are behaviorally equivalent.

## Persistence inventory

### Firestore collections observed

The following collection names are referenced by current application code. Some are legacy aliases, test-only paths, or migration infrastructure; collection discovery alone does not prove active production writes.

| Collection | Primary observed responsibility |
|---|---|
| `users` | account profile, plan, billing/customer references, site ownership metadata |
| `sites` | site/configuration documents and public content |
| `site_memberships` | workspace/site roles |
| `site_slug_redirects` | handle/slug migration redirects |
| `handles` | handle reservations/checks |
| `sessions` | server sessions and revocation |
| `referrals` | referral qualification and expiry |
| `account_deletion_requests` | deletion workflow |
| `creator_products` | products, prices, legacy inventory counters, Stripe product/price IDs |
| `orders` | public checkout/order records and state |
| `payments` | payment records in repository abstraction |
| `fulfillments` | fulfillment records in repository abstraction |
| `inventory` | inventory records in repository abstraction; legacy product counters also exist |
| `bookings` | booking records |
| `booking_locks` | booking conflict/lock records |
| `idempotency_keys` | request/workflow idempotency |
| `calendar_integrations` | calendar connection metadata |
| `calendar_jobs` | calendar synchronization work |
| `notification_jobs` | email/notification work |
| `audience_subscribers` | creator audience subscribers |
| `audience_submissions` | contact/form submissions |
| `newsletter_subscribers` | legacy/public newsletter records |
| `contacts` | legacy/public contact records |
| `analytics_rollups` | bounded creator/platform analytics aggregates |
| `analytics_visitor_days` | visitor-day aggregates |
| `media_assets` | media metadata, lifecycle and ownership |
| `custom_domains` | domain ownership/provisioning/SSL state |
| `creator_integrations` | social/provider integrations |
| `oauth_connections` | centralized OAuth connection records |
| `oauth_states` | OAuth CSRF/state flow |
| `stripe_events` | Stripe event idempotency/processing |
| `billing_webhook_events` | billing webhook records |
| `billing_reconciliation_runs` | billing reconciliation audit |
| `outbox_events` | transactional/outbound event queue |
| `background_jobs` | durable job records |
| `rate_limits` | Firestore-backed rate-limit buckets |
| `stateTransitions` | legacy/order state transition history |

Subcollection patterns include `users/{uid}/sites`, and the repository code uses collection-group access for `sites`. The exact document shape is not uniform across direct route code and repository implementations, which is a migration risk.

### Firebase Storage

| Usage | Current implementation | Risk |
|---|---|---|
| Creator avatar/profile photo | client Firebase Storage SDK in [`src/components/modals/AccountSettingsModal.tsx`](../../src/components/modals/AccountSettingsModal.tsx) | provider behavior leaks into Studio |
| Site media upload | `adminStorage` in [`server.ts`](../../server.ts), with Sharp optimization and thumbnail generation | synchronous HTTP processing and provider coupling |
| Media metadata | Firestore `media_assets` | metadata and blob lifecycle can diverge |
| Provider abstraction | [`server/adapters/media-storage.ts`](../../server/adapters/media-storage.ts) | seam exists; legacy path still active |
| R2 support | adapter type/factory exists | not established as authoritative runtime provider |

## Authentication, authorization, and security rules

### Authentication flows

- Firebase client authentication is initialized in [`src/lib/firebase.ts`](../../src/lib/firebase.ts) and consumed by [`src/contexts/AuthContext.tsx`](../../src/contexts/AuthContext.tsx).
- Server authentication verifies Firebase bearer/session credentials in [`server-services.ts`](../../server-services.ts), with register/login/session/logout/password reset/email verification and Google/Apple OAuth endpoints in [`server.ts`](../../server.ts).
- Firebase Auth establishes identity. Application authorization is represented by [`server/core/authorization-policy.ts`](../../server/core/authorization-policy.ts) and [`server/core/authorization-service.ts`](../../server/core/authorization-service.ts), resolving account, site, membership role, plan capabilities, and action permissions.
- Raw OAuth/provider credentials are intended to be isolated by [`server/domains/integrations/oauth-service.ts`](../../server/domains/integrations/oauth-service.ts), [`server/adapters/oauth.ts`](../../server/adapters/oauth.ts), and the Firestore OAuth repository. Legacy calendar/social route code remains a coupling point.

### Business and security checks found

| Rule/check | Current location/implementation |
|---|---|
| Firebase identity/bearer validation | `server-services.ts`, auth middleware in `server.ts` |
| site ownership and membership role | `server/core/authorization-policy.ts`, legacy `hasAuthorizedSiteAccess` paths |
| plan capability/entitlement limits | `src/lib/planCapabilities.ts`, `server/core/authorization-policy.ts`, entitlement service/tests |
| tenant/site boundary assertion | `assertSite`, tenant policies, repository filters, tests |
| reserved/unique handle checks | handle routes and site persistence helpers |
| publish eligibility/content validation | `server/core/domain-invariants.ts`, `src/shared/schema`, content schema |
| booking overlap/conflict | booking locks, idempotency, invariant helpers; legacy checks remain in route flow |
| positive inventory and reservation bounds | `server/core/domain-invariants.ts`; legacy product counters remain |
| order state transitions | [`server/domains/orders/state-machine.ts`](../../server/domains/orders/state-machine.ts) and `stateTransitions` |
| Stripe webhook idempotency | Stripe event/billing webhook collections and adapter/service paths |
| OAuth connection state | `OAuthConnectionState`, token service, refresh/revocation logic |
| public form/booking/telemetry rate limits | `server/core/rate-limit-policy.ts` plus in-memory/Firestore bucket implementations |
| media size/type/quota and ownership | upload routes, Sharp metadata, plan limits, `media_assets` filters |
| provider secrets/encryption | secrets provider and envelope-encryption packages; runtime adoption must still be verified |
| audit logging | audit service/Firestore implementation and sensitive-action tests |
| request IDs/structured logs | observability middleware and provider/job logging |

## Dependency map

| Component | Calls/depends on | Owns/produces | High-risk coupling |
|---|---|---|---|
| React/Vite Studio | Firebase Auth, API fetches, Firebase Storage upload, shared schemas/design helpers | creator UI state | client/provider behavior and API shapes are mixed |
| Public renderer | public API/Firestore-backed site payloads, shared design/render contracts | public page output/metadata | current renderer is not separated as Next.js workload |
| `server.ts` | Express, Firebase Admin/Firestore/Auth/Storage, Stripe, Sharp, calendar/domain helpers, repositories, services | almost all HTTP behavior | monolithic transport/business/persistence/provider boundary |
| `server-services.ts` | Firebase Admin, Stripe, repositories/services | auth/account/billing/domain helpers | shared singleton/service module is broad |
| domain services | repository interfaces, typed adapters, schemas, jobs/events | business rules | some paths still bypass them through legacy routes |
| repositories | Firestore today; PostgreSQL migration implementations | persistence | direct Firestore use remains in routes/controllers |
| adapters | Stripe, Cloudflare, storage, OAuth/calendar, email | provider translation | adapter coverage exists but legacy SDK calls remain |
| `worker.ts` | job/outbox repositories, providers | async side effects | operational endpoints are not in API contract; durable provider deployment not proven |
| analytics | public telemetry, Firestore rollups, analytics storage abstractions | rollups/raw event policy | raw analytics is not yet fully separated into BigQuery/equivalent |
| PostgreSQL package | `pg`, migrations, Drizzle schema/foundation | target transactional persistence | not yet authoritative for production request paths |

## Current data ownership matrix

| Capability | Effective owner today | Intended target owner | Current confidence |
|---|---|---|---|
| identity | Firebase Auth | Firebase Auth adapter | high |
| site/editor configuration | Firestore `users/{uid}/sites`/`sites` | Firestore where document/realtime value remains | medium; duplicate access paths |
| published public payload | Firestore + Express/public renderer | cached published projection/public app | medium |
| bookings/availability | Firestore bookings/locks/jobs | PostgreSQL transactional booking domain | low-to-medium; migration seam exists |
| products | Firestore `creator_products` | PostgreSQL products/variants | medium |
| inventory | embedded product counters plus repository abstractions | PostgreSQL stock/reservations/movements | low; dual semantics present |
| orders/payments | Firestore orders + Stripe | PostgreSQL order/payment state, Stripe event source | medium |
| subscriptions/entitlements | Firestore user/billing fields + Stripe | authoritative internal subscription/entitlement model | medium |
| audience | Firestore audience collections | repository-backed relational or retained Firestore domain | medium |
| analytics | Firestore raw/rollups and analytics abstractions | raw analytical store + PostgreSQL rollups | low-to-medium |
| media metadata | Firestore `media_assets` | repository-backed metadata store | medium |
| media bytes | Firebase Storage | storage adapter with Firebase/R2 implementations | medium |
| domains | Firestore `custom_domains` + Cloudflare | domain provisioning service + relational ownership | medium |
| OAuth/integrations | Firestore connection/state collections + providers | encrypted integration service | medium |
| jobs/outbox | Firestore job/outbox records, worker routes | Cloud Tasks/Pub/Sub implementation behind job interface | low-to-medium |

## Provider dependency matrix

| Provider | Current touchpoints | Domain impact | Adapter status |
|---|---|---|---|
| Firebase Auth | client SDK, Admin verification, auth routes | identity/session | partly abstracted |
| Firestore | direct `server.ts` queries, repositories, jobs, flags, audit | nearly every domain | repository interfaces exist; direct legacy access remains |
| Firebase Storage | client avatar upload, Admin media upload | media | storage adapter exists; client leak remains |
| Stripe | billing/order routes, webhook, reconciliation | billing, orders, entitlements | Stripe adapter exists; direct route coupling remains |
| Cloudflare | domain provisioning/verification/routing | domains/public routing | adapter/service exists; provider state in route flow |
| Google Calendar | OAuth/calendar adapter and jobs | bookings/integrations | adapter/job seams exist |
| Microsoft Graph/Outlook | calendar adapter and jobs | bookings/integrations | adapter/job seams exist |
| Resend/email API | email adapter and notification worker | notifications/audience/bookings/billing | adapter exists; some legacy synchronous paths require audit |
| Sharp | upload route processing | media | library directly used in `server.ts`; should move to worker |
| PostgreSQL/`pg` | target migrations/repositories/health | transactional domains | foundation present; not current universal authority |
| BigQuery/equivalent | target analytics design | raw analytics | not confirmed as active runtime dependency |

## Feature-to-backend mapping and readiness

| Feature | Backend paths | Classification | Reason/evidence |
|---|---|---|---|
| marketing/landing pages | Vite React, static assets | partially implemented | route exists, but current reported landing-page failure needs separate runtime investigation |
| authentication/session | Firebase Auth + Express auth endpoints + Firestore sessions | partially implemented | broad flow exists; production provider/config coverage is not proven by this baseline |
| Studio site editing | React/Vite + site persistence helpers | partially implemented | working surface but direct persistence and provider coupling remain |
| public creator pages | public renderer + Firestore/API + host routing | migration-risk | high-read/SEO boundary is not yet an independent Next.js app |
| publishing | site records, publish eligibility, public projection | partially implemented | rules exist; cache/projection ownership is not fully separated |
| audience/newsletter/contact | Firestore audience/contact collections + email jobs | partially implemented | legacy collection aliases and async delivery paths coexist |
| analytics | telemetry routes + Firestore rollups/visitor days | partially implemented | bounded rollups exist; analytical raw-event destination is not established |
| bookings | Firestore bookings/locks/idempotency + calendar jobs | migration-risk | PostgreSQL migration and concurrency verification are incomplete; calendar is async seam |
| products | Firestore creator products + Stripe product/price IDs | partially implemented | legacy product model remains authoritative |
| orders/payments | Firestore orders + Stripe checkout/webhook | migration-risk | state machine exists but legacy and target persistence models coexist |
| inventory | product counters + target PostgreSQL tables/repositories | migration-risk | two inventory semantics can diverge and overselling risk is material |
| billing/subscriptions | Stripe + Firestore user/billing/webhook/reconciliation records | partially implemented | internal model exists but Stripe remains heavily coupled to HTTP paths |
| integrations/OAuth | Firestore states/connections + provider adapters | partially implemented | central service exists; raw provider flow still spans routes |
| media | Firebase Storage + Sharp + Firestore metadata | migration-risk | synchronous processing and client storage access remain |
| domains | Cloudflare + Firestore custom domains + verification jobs | migration-risk | async workers exist; public routing/SSL semantics have failing legacy expectations |
| background jobs | Firestore jobs, in-process dev queue, worker routes | partially implemented | idempotency/retries/dead-letter abstractions exist; production queue selection/observability needs proof |
| PostgreSQL foundation | `pg`, migrations, schema, repositories | demo/migration-risk | local/dev and migration infrastructure exists; no production cutover |
| Next.js public app | no independent app yet | demo/obsolete as current runtime; migration target | target architecture only, not a current deployed feature |

“Production-ready” is intentionally reserved here for bounded behavior with passing production-like evidence. No broad domain is marked fully production-ready solely because a route exists.

## Background-like operations

| Operation | Current trigger | Current state |
|---|---|---|
| email delivery | route-created notification records and worker | job abstraction/worker exists; verify all route paths enqueue rather than send |
| calendar create/update/cancel | booking routes and calendar jobs | asynchronous worker and reconciliation exist |
| domain verification/SSL | domain routes and verification worker | retryable workflow exists; state/route behavior still migration-risk |
| Stripe webhook/reconciliation | Stripe webhook and internal reconciliation route/job | idempotency records exist; authoritative subscription/order cutover incomplete |
| analytics rollup | telemetry writes and rollup jobs | bounded rollup path exists; raw analytics destination unresolved |
| media processing/cleanup | upload route and media cleanup | Sharp currently runs in HTTP path; processing abstraction exists |
| outbox publication | state changes and internal publish endpoint | outbox abstraction exists; operational routes undocumented |
| account deletion/export | account request route and cleanup script | background-like deletion workflow; retention/recovery evidence incomplete |
| rate-limit cleanup | in-memory/Firestore buckets | operational cleanup needed; not a dedicated durable platform |

## Current test coverage map

| Layer | Command/files | Coverage baseline |
|---|---|---|
| Type/lint | `npm run lint` | passed; TypeScript no-emit |
| Build | `npm run build` | passed; Vite emitted large-chunk warnings |
| Unit | `npm run test:unit`, `tests/unit/order-state-machine.test.ts` | 2/2 passed |
| HTTP integration | `npm run test:http`, `tests/http/api.integration.test.ts` | 5/5 passed |
| Provider contracts | `npm run test:contracts`, `tests/contracts/provider-adapters.test.ts` | 10/10 passed |
| Browser/E2E | `npm run test:e2e`, `e2e/studio.spec.ts` | 6 passed, 2 skipped, 2 failed; two Studio preview snapshots differ by 2px width/13,991 pixels |
| Legacy harness | `npm run test:legacy`, [`tests/legacy-manifest.json`](../../tests/legacy-manifest.json) | 40/42 passed; exit 1 |
| API contracts | `npm run check:api`, OpenAPI/docs | failed: 9 undocumented routes, 46 pending docs |
| Architecture/policy scripts | individual `test-*`, `check-*` scripts | many targeted suites are included in legacy manifest; no single immutable baseline report existed before this document |
| Real provider staging | `npm run test:integration:staging` | not run in this local baseline; requires staging credentials/provider access |

### Legacy failures recorded

1. `test-modules-2-4.ts`: the seeded existing creator handle `elena` was expected to be unavailable but was reported available.
2. `test-entrypoint.ts`/custom-domain expectations: public-profile/custom-domain cases produced `503`/`404` where the legacy test expected seeded profile/custom-domain behavior. The same harness also includes passing assertions that production mode does not fall back to demo content.

These failures must be triaged before a datastore or public-rendering cutover; they are now part of the regression baseline rather than being silently treated as migration regressions later.

## Exact refactor/migration map

### First seam: HTTP and persistence boundary

Refactor or move behavior from:

- [`server.ts`](../../server.ts): split route registration into domain controllers; remove direct `adminDb`/`adminStorage` calls from handlers; leave compatibility routes and response shapes intact.
- [`server-services.ts`](../../server-services.ts): reduce broad singleton responsibilities into application services and typed provider factories.
- [`server/repositories/firestore.ts`](../../server/repositories/firestore.ts): make it the only Firestore implementation consumed by domain services for the migrated domains.
- [`server/repositories/site-persistence.ts`](../../server/repositories/site-persistence.ts): establish site repository ownership and public projection read contract.
- [`server/http/controllers`](../../server/http/controllers): make controllers transport-only and consistently invoke authorization, schemas, services, and error mapping.

### Domain modules

The target bounded modules are present in varying maturity. The next migration units should be:

- sites/publishing: `server/domains/sites`, `server/domains/publishing`, site repositories, public-site adapter;
- bookings: `server/domains/bookings`, `server/infrastructure/postgres/bookings-repository.ts`, `server/domains/bookings/migration.ts`, `scripts/migrate-bookings.ts`;
- commerce: `server/domains/commerce`, `server/infrastructure/postgres/commerce-repositories.ts`, product/order routes in `server.ts`;
- billing: Stripe adapter/service, billing webhook/reconciliation records;
- integrations: OAuth service, calendar adapters, encrypted token repository;
- media: `server/domains/media`, `server/adapters/media-storage.ts`, Sharp processing path;
- domains: `server/domains/domains`, Cloudflare adapter, verification worker;
- analytics/audience: repositories and rollup/pipeline services;
- jobs/events: `server/background-jobs`, `server/outbox`, `server/events`, `worker.ts`.

### Static guardrails already available

The repository has boundary checks such as [`scripts/check-persistence-boundary.mjs`](../../scripts/check-persistence-boundary.mjs), route persistence checks, provider boundary checks, and modular-monolith checks. They should be made mandatory in CI after the baseline is accepted. The current baseline must first distinguish intentional compatibility exceptions from violations.

## Migration risks ranked

| Risk | Severity | Evidence |
|---|---|---|
| Direct Firestore access in monolithic handlers | critical | `server.ts` contains domain queries/writes across sites, bookings, audience, analytics, media, commerce, billing, and domains |
| Booking double-write/semantic drift during PostgreSQL cutover | critical | Firestore locks/idempotency and PostgreSQL slot constraints coexist |
| Inventory overselling or reconciliation ambiguity | critical | legacy `creator_products` counters coexist with normalized inventory/movement model |
| Stripe event/order/subscription divergence | critical | Stripe source events, Firestore state, state history, and target repositories overlap |
| Public profile availability/custom-domain behavior | high | legacy failures and current host/provider dependency |
| Firestore document shape drift | high | direct route writes and repository shapes differ; collection aliases exist |
| Media storage/metadata orphaning | high | synchronous Sharp + multiple storage paths + Firestore metadata |
| OAuth token exposure/refresh races | high | provider flows span route code, Firestore state, and adapter/service seams |
| Contract incompleteness | high | 94 runtime routes vs 85 operations; 9 undocumented operational routes and 46 pending docs |
| Browser visual drift | medium | two Playwright Studio snapshots fail |
| Test fixture/environment dependence | medium | `elena` and custom-domain legacy expectations fail under current seeded/configured state |
| PostgreSQL migration assumptions | medium | local schema/verification tools exist, but production authority and rollback evidence do not |

## Baseline acceptance criteria for the next phase

Do not call a migration behaviorally equivalent until all of the following are true for the bounded domain:

1. Route response/status/error behavior is captured in contract and HTTP integration tests.
2. Firestore and PostgreSQL reads reconcile for a fixed backfill checkpoint and representative fixtures.
3. Concurrent booking/inventory tests pass against real PostgreSQL constraints.
4. Stripe/provider webhooks and jobs are idempotent under duplicate delivery.
5. Tenant-negative tests prove cross-site reads/writes fail.
6. Public rendering and custom-domain canonical/SSL behavior match the captured baseline.
7. The legacy suite has no unexplained failure and the E2E snapshots are either accepted as intentional or regenerated deliberately.
8. Cutover is feature-flagged with shadow reads, metrics, rollback, and a forward-fix plan.

## Regression command ledger

| Command | Result on 2026-09-27 | Notes |
|---|---|---|
| `npm run lint` | PASS | TypeScript no-emit |
| `npm run build` | PASS | large chunk warnings; no build failure |
| `npm run test:unit` | PASS | 2 tests |
| `npm run test:http` | PASS | 5 tests |
| `npm run test:contracts` | PASS | 10 tests |
| `npm run test:e2e` | FAIL | 6 passed, 2 skipped, 2 visual failures |
| `npm run test:legacy` | FAIL | 40/42 passed; 2 failures |
| `npm run check:api` | FAIL | 9 undocumented routes, 46 pending docs |
| `npm run test:integration:staging` | NOT RUN | requires external staging providers/credentials |

The generated legacy JUnit report is [`reports/legacy-tests.xml`](../../reports/legacy-tests.xml). This document is the durable human-readable baseline. Future migration work should append dated results or create a new dated baseline rather than overwriting this record.

## Baseline conclusion

The system is suitable for incremental modular-monolith migration, not a big-bang architecture replacement. Firestore is still the effective source of truth for most features; PostgreSQL is a prepared target for strongly transactional domains. The highest-value next action is to resolve and freeze the current regression failures, complete API contract coverage for operational routes, and enforce route-to-repository/provider boundaries before switching any authoritative read or write path.
