# Principal architecture inventory

Audit date: 2026-09-27  
Scope: Express/Vite application, modular server packages, workers, repositories, adapters, deployment manifests, and shared schemas.  
Method: static inspection of route declarations, imports, persistence calls, provider calls, module composition, worker handlers, and existing API/architecture documents. No runtime behavior was changed.

## Executive assessment

RALOA is a feature-rich modular-monolith transition, not yet a clean modular monolith. The intended boundaries exist in `server/domains`, `server/repositories`, `server/adapters`, `server/background-jobs`, `server/outbox`, and `server/events`, but the compatibility shell in `server.ts` still owns most route behavior, Firestore access, provider calls, validation, authorization, and orchestration.

The highest-risk coupling is the combination of:

1. `server.ts` as HTTP entrypoint, composition root, legacy controller, application service, repository, and provider client;
2. `server-services.ts` combining Firebase initialization, public-site reads, billing, Stripe webhooks, Cloudflare, and order reconciliation;
3. Firestore being directly accessed by routes for sites, bookings, audience, products, orders, billing, integrations, domains, media, sessions, analytics, jobs, and outbox;
4. provider side effects occurring synchronously inside HTTP handlers, especially Stripe product/checkout operations, Cloudflare domain provisioning, calendar OAuth/API calls, email, and media processing;
5. module interfaces existing but not being the route authority: `domainModules` is composed in `server.ts`, while most legacy handlers continue to bypass those services.

The safest strategy is a strangler migration: keep `server.ts` behavior stable, move one route slice at a time behind existing service/repository contracts, prove equivalence, then retire direct legacy code.

## Runtime dependency map

```text
Cloudflare DNS/CDN/domains
        |
        +--> Express public-web compatibility role
        |       +--> public site reads/cache
        |       +--> public booking, forms, telemetry, products
        |
        +--> Express studio-api role
                +--> authentication/session policy
                +--> legacy route handlers in server.ts
                +--> domain services/repositories (partial adoption)
                +--> Firestore (current broad authority)
                +--> PostgreSQL infrastructure (target, not yet route authority)
                +--> Stripe / calendars / GitHub / email / storage adapters
                +--> outbox + domain events + background job enqueue
                                      |
                                      +--> Cloud Tasks/Pub/Sub dispatcher
                                              |
                                              +--> worker.ts
                                                      +--> jobs, outbox publishing,
                                                          provider sync, media, analytics

Studio React/Vite --> API contract --> studio-api
Public rendering currently shares the compatibility image; Next.js is a documented
future public boundary, not a deployed implementation.
```

## Route inventory

All application routes below are declared in `server.ts`. The line ranges are the current refactor anchors; they are expected to move with the route blocks.

### Platform/public delivery

| Routes | Current block | Primary context | Notes |
| --- | ---: | --- | --- |
| `GET /api/health`, `GET /api/readiness` | 182, 3226-3258 | Platform/runtime | Readiness checks Firebase, Stripe, URL, session secret, Cloudflare; no migration-version check. |
| `POST /api/webhooks/stripe` | 186-204 | Billing/orders | Raw body/signature handling enters legacy billing path before JSON middleware. |
| `GET /robots.txt`, `GET /llms.txt`, `GET /sitemap.xml` | 1654-1737 | Publishing/SEO | Sitemap reads published site data directly. |
| `GET /api/public/sites/:handle` | 3889-3950 | Publishing/sites | Public normalized site payload; candidate for public renderer adapter. |
| `GET /api/v1/public/products/:handle` | 4311-4319 | Products/publishing | Reads site and products. |
| `GET /api/v1/public/scheduling/:handle/config` | 1935-1943 | Bookings/publishing | Public booking configuration. |
| `GET /api/v1/public/scheduling/:handle/availability` | 1945-1965 | Bookings | Availability query. |
| `GET /api/v1/handles/check` | 1867-1903 | Sites | Handle availability. |
| `POST /api/v1/handles/reserve` | 1905-1933 | Sites | Authenticated handle transaction. |

### Booking and audience

| Routes | Current block | Primary context |
| --- | ---: | --- |
| `POST /api/v1/public/bookings` | 1967-2066 | Bookings, calendar, notifications |
| `GET /api/creator/bookings` | 2068-2092 | Bookings |
| `POST /api/creator/bookings/:bookingId/confirm` | 2094-2126 | Bookings, notifications, calendar |
| `POST /api/creator/bookings/:bookingId/cancel` | 2128-2158 | Bookings, notifications, calendar |
| `POST /api/v1/public/newsletter` | 2160-2306 | Audience/email |
| `GET /api/creator/audience` | 2308-2375 | Audience, site ownership |
| `POST /api/creator/audience/subscribers` | 2377-2397 | Audience |
| `PATCH /api/creator/audience/:kind/:id` | 2399-2421 | Audience |
| `DELETE /api/creator/audience/:kind/:id` | 2423-2442 | Audience |
| `GET /api/creator/audience/export` | 2444-2482 | Audience/export |
| `POST /api/v1/public/contact` | 2484-2560 | Audience/contact/email |

### Analytics and authentication/account

| Routes | Current block | Primary context |
| --- | ---: | --- |
| `POST /api/v1/public/telemetry/page-view` | 2562-2586 | Analytics ingestion |
| `POST /api/v1/public/telemetry/link-click` | 2588-2619 | Analytics ingestion |
| `POST /api/v1/auth/register` | 2621-2697 | Identity/account/referrals |
| `POST /api/v1/auth/login` | 2699-2818 | Identity/session/rate limit |
| `POST /api/v1/auth/logout` | 2820-2849 | Identity/session |
| `POST /api/v1/auth/forgot-password` | 2851-2897 | Identity/email |
| `POST /api/v1/auth/reset-password` | 2899-2954 | Identity |
| `POST /api/v1/auth/oauth/google` | 2956-3005 | Identity |
| `POST /api/v1/auth/oauth/apple` | 3007-3056 | Identity |
| `GET /api/v1/auth/session` | 3058-3072 | Identity/session |
| `POST /api/v1/auth/session` | 3074-3098 | Identity/session |
| `GET /api/account/sessions` | 3100-3147 | Identity/session |
| `DELETE /api/account/sessions/:sessionId` | 3149-3166 | Identity/session |
| `POST /api/account/sessions/revoke-all` | 3168-3204 | Identity/session/Firebase Auth |
| `POST /api/v1/auth/verify-email` | 3206-3224 | Identity |
| `GET /api/account/profile` | 3296-3309 | Account/profile |
| `PUT /api/account/profile` | 3311-3353 | Account/profile |
| `GET /api/account/preferences` | 3355-3371 | Account/preferences |
| `PUT /api/account/preferences` | 3373-3396 | Account/preferences |
| `GET /api/analytics/platform` | 3593-3725 | Analytics/platform admin |
| `POST /api/account/delete-request` | 3445-3467 | Account/lifecycle |
| `GET /api/account/export` | 3469-3591 | Account/export across contexts |

### Media, sites, products, and orders

| Routes | Current block | Primary context |
| --- | ---: | --- |
| `POST /api/media/upload` | 3727-3800 | Media/storage/processing |
| `GET /api/media` | 3802-3816 | Media |
| `GET /api/media/:mediaId/url` | 3818-3832 | Media/storage |
| `DELETE /api/media/:mediaId` | 3834-3853 | Media/storage |
| `POST /api/media/cleanup` | 3855-3868 | Media/cleanup |
| `GET /api/media/public/:mediaId` | 3870-3887 | Media/public delivery |
| `GET /api/sites` | 3952-3978 | Sites |
| `POST /api/sites` | 3980-4027 | Sites/publishing |
| `DELETE /api/sites/:siteId` | 4029-4049 | Sites/media/domains |
| `PUT /api/sites/:siteId` | 4051-4184 | Sites/publishing/slug redirects |
| `GET /api/creator/products` | 4186-4205 | Products |
| `POST /api/creator/products` | 4207-4241 | Products/Stripe |
| `PATCH /api/creator/products/:productId` | 4243-4289 | Products/Stripe |
| `DELETE /api/creator/products/:productId` | 4291-4309 | Products/Stripe |
| `POST /api/v1/public/products/:handle/checkout` | 4321-4373 | Commerce/Stripe/inventory |
| `GET /api/account/orders` | 4375-4390 | Orders/customer |
| `GET /api/creator/orders` | 4392-4428 | Orders/creator/products |
| `PATCH /api/creator/orders/:orderId/fulfillment` | 4430-4535 | Orders/inventory/fulfillment |

### Billing, integrations, calendars, and domains

| Routes | Current block | Primary context |
| --- | ---: | --- |
| `POST /api/billing/activate-free` | 4537-4551 | Billing/subscriptions/referrals |
| `POST/GET /api/billing/checkout-session` | 4553-4571 | Billing/Stripe |
| `POST /api/v1/referrals/qualify` | 4573-4632 | Billing/referrals |
| `POST /api/billing/portal-session` | 4634-4636 | Billing/Stripe |
| `GET /api/integrations/providers` | 4638-4641 | Integrations |
| `GET /api/integrations` | 4643-4654 | Integrations |
| `GET /api/integrations/github/start` | 4656-4671 | Integrations/GitHub OAuth |
| `GET /api/integrations/github/callback` | 4673-4706 | Integrations/GitHub OAuth |
| `POST /api/integrations/:provider/refresh` | 4708-4725 | Integrations/OAuth |
| `DELETE /api/integrations/:provider` | 4727-4750 | Integrations/OAuth |
| `GET /api/calendar/integrations` | 4752-4763 | Integrations/calendar |
| `GET /api/calendar/:provider/start` | 4765-4785 | Google/Microsoft OAuth |
| `GET /api/calendar/:provider/callback` | 4787-4813 | Google/Microsoft OAuth |
| `DELETE /api/calendar/:provider` | 4815-4823 | Integrations/calendar |
| `GET /api/domains` | 4825-4841 | Domains |
| `POST /api/domains/provision` | 4843-4944 | Domains/Cloudflare |
| `POST /api/domains/verify` | 4946-4987 | Domains/Cloudflare |
| `DELETE /api/domains/:domainId` | 4989-5015 | Domains/Cloudflare |

### Internal and static routes

| Routes | Current block | Owner |
| --- | ---: | --- |
| `POST /internal/background-jobs/run` | 5250-5263 | Legacy job runner |
| `POST /internal/background-jobs/reconcile` | 5265-5271 | Legacy job recovery |
| `POST /internal/outbox/publish` | 5273-5278 | Outbox publisher |
| `GET /*` | 5017-5040 | Vite/static/public fallback |
| Error middleware | 5280 onward | Transport boundary |

The separate `worker.ts` exposes `GET /health`, `POST /tasks/background-jobs`, and `POST /tasks/outbox-publish`. It imports `backgroundJobs` and `outbox` from `server.ts`, which couples worker startup to the full HTTP composition root.

## Persistence inventory

### Firestore direct access in the compatibility shell

| Collection/group | Context | Current access |
| --- | --- | --- |
| `users`, `users/{uid}/sites`, collection-group `sites` | Identity, sites, publishing, account | Directly in `server.ts` and `server-services.ts`; largest shared coupling surface |
| `handles`, `site_slug_redirects` | Sites/publishing | Direct transactions and lookups in `server.ts` |
| `bookings`, `booking_locks` | Bookings | Direct reads, writes, and transactions in `server.ts` |
| `calendar_jobs`, `notification_jobs` | Bookings/workers | HTTP handlers enqueue/read directly; worker handlers live in `server.ts` |
| `audience_subscribers`, `audience_submissions`, `newsletter_subscribers`, `contacts` | Audience | Direct route persistence |
| `analytics_rollups`, `analytics_visitor_days` | Analytics | Direct dashboard queries and rollup writes |
| `creator_products` | Products/commerce/media | Direct product persistence and Stripe coupling |
| `orders` | Orders/commerce | Direct checkout, customer/creator reads, fulfillment, and webhook reconciliation |
| `stripe_events`, `billing_webhook_events`, `billing_reconciliation_runs` | Billing | Direct webhook/reconciliation state |
| `creator_integrations`, `calendar_integrations`, `oauth_states` | Integrations | Direct OAuth/token metadata access |
| `custom_domains` | Domains | Direct provisioning/verification/deletion |
| `media_assets` plus Firebase Storage objects | Media | Direct upload, transform, signed URL, cleanup, and ownership reads |
| `sessions`, `rate_limits`, `idempotency_keys` | Platform/security | Direct auth/session/rate-limit/idempotency persistence |
| `outbox_events` | Events/platform | Direct transaction writes plus outbox service |

The repository layer in `server/repositories/firestore.ts` and contracts in `server/repositories/contracts.ts` cover many of these domains, but legacy route paths frequently bypass them. The PostgreSQL schema and Drizzle model are target infrastructure; the listed HTTP routes do not yet consistently use PostgreSQL repositories.

## External provider inventory

| Provider | Adapter/current entrypoint | Coupling and risk |
| --- | --- | --- |
| Firebase Auth | `server/adapters/firebase-auth.ts`, `server-services.ts` | Identity/session behavior is mixed with local auth fixtures and direct `adminAuth` calls in `server.ts`. |
| Firebase Firestore | `server/repositories/firestore.ts`, `server/infrastructure/firestore-repository.ts`, direct `adminDb` calls | Broad legacy authority; collection paths and document shapes leak into routes. |
| Firebase Storage | `adminStorage` in `server.ts`, `server/adapters/media-storage.ts` | Upload processing remains synchronous in the HTTP lifecycle. |
| Stripe | `server/adapters/stripe.ts`, Stripe calls in `server-services.ts` and `server.ts` | Products, checkout, webhooks, billing state, order state, and reconciliation are cross-coupled. |
| Cloudflare | `server/adapters/cloudflare.ts`, `cloudflare-domains.ts`, direct calls in `server.ts` | Domain provisioning/verification is synchronous and directly mutates provider plus Firestore state. |
| Google Calendar | `server-calendar.ts`, `server/adapters/calendar.ts` | OAuth and event sync share token/configuration logic with route handlers. |
| Microsoft Graph | `server-calendar.ts`, `server/adapters/calendar.ts` | Same calendar coupling and retry/idempotency concerns as Google. |
| GitHub | Inline OAuth functions in `server.ts` around 787-850 | Not fully behind the integrations adapter contract. |
| Resend/email | Inline sender in `server.ts` around 1125-1155 and `server/adapters/email.ts` | Duplicate provider entrypoints; notification work can be request-bound. |
| Cloud Tasks/Pub/Sub | `server/background-jobs/dispatchers.ts` | Job dispatch is abstracted, but worker imports full `server.ts`. |
| BigQuery/analytical store | Policy and pipeline interfaces only | No concrete production warehouse adapter is visible in this repository. |

## Existing domains and proposed bounded contexts

| Bounded context | Existing module | Canonical responsibilities | Required ownership |
| --- | --- | --- | --- |
| Identity & account | Mostly `server.ts`/`server-services.ts` | Auth identity, sessions, profile, preferences, deletion/export | Own `users`, sessions, auth adapter, account policy; no billing/provider calls in controllers |
| Sites & publishing | `server/domains/sites`, `publishing` | Site drafts, handles, publication, public normalized page data, redirects | Own site repository and published cache contract |
| Audience | `server/domains/audience` | Subscribers, submissions, newsletter, contact/export | Own audience repositories and email intents |
| Bookings | `server/domains/bookings` | Services, availability, reservations, booking state, attendees | Own booking transaction, idempotency, calendar/notification events |
| Commerce/catalog | `products`, `inventory`, `orders` | Product/variant catalog, inventory, checkout order, fulfillment | Split catalog from order/inventory internally; Stripe is an adapter only |
| Billing/subscriptions | `billing`, `subscriptions` | Customer/subscription state, entitlements, webhook reconciliation | Own provider event claims and subscription authority |
| Integrations | `integrations` | OAuth connections, tokens, scopes, provider sync | Own encrypted credentials and provider adapter selection |
| Domains | `domains` | Ownership, DNS instructions, verification, certificates, routing | Own Cloudflare adapter and retryable provisioning jobs |
| Media | `media` | Upload metadata, object lifecycle, variants, processing | Own storage adapter and async processing state |
| Analytics | `analytics`, `server/infrastructure/analytics` | Append ingestion, deduplication, raw sink, rollups, dashboards | Own event contract and warehouse adapter; no raw scans in API |
| Platform workflow | `background-jobs`, `outbox`, `events` | Jobs, retries, idempotency, event publication, audit/observability | Own worker process independent of HTTP composition |

## Cross-domain dependency map

```text
Identity/account
  -> authorization/tenant scope
  -> sites/publishing, audience, bookings, commerce, billing, integrations, media, domains

Sites/publishing
  -> public cache/renderer
  -> bookings (booking config), products (catalog), domains (routing), media (assets)

Bookings
  -> calendar integration, email notifications, analytics events

Commerce
  products -> inventory -> orders -> Stripe payment events -> fulfillment/email

Billing
  Stripe webhook/reconciliation -> subscriptions -> entitlements -> authorization/UI capability

Integrations
  OAuth credentials -> calendar/GitHub/provider synchronization workers

Domains/media/analytics
  all emit outbox/domain events -> worker queues -> external providers/analytical storage
```

High-risk cycles are `sites -> products -> checkout -> orders -> sites`, `billing -> authorization -> account -> billing`, and `bookings -> integrations -> calendar jobs -> bookings`. These should communicate through intent-named services/events, not repositories or direct collection reads.

## High-risk coupling findings

| Severity | Exact files | Finding | Consequence |
| --- | --- | --- | --- |
| Critical | `server.ts` (entire file, especially 186-204, 1967-2158, 3727-5015) | HTTP handlers mix auth, validation, direct Firestore, provider calls, transactions, events, and response formatting. | Any domain change can alter unrelated routes; unit testing requires the whole composition root. |
| Critical | `server-services.ts` | Firebase bootstrap, public-site reads, billing, Stripe webhooks, Cloudflare, orders, and reconciliation share one module. | Provider outage or billing change has a wide blast radius; circular adapter dependencies are likely. |
| Critical | `server.ts` product/checkout/order blocks 4186-4535 | Product mutation calls Stripe, writes Firestore, creates orders, reserves inventory, and emits outbox events in one compatibility path. | Partial failure can leave provider/catalog/order state divergent; requires order service + idempotent workflow. |
| Critical | `server.ts` booking blocks 1967-2158 | Booking transactions also directly create notification/calendar jobs and read host/profile/site data. | Booking consistency and side effects are coupled; hard to migrate to PostgreSQL safely. |
| High | `server.ts` media block 3727-3887 | Image processing and object writes occur in the request lifecycle. | Slow requests, retry ambiguity, and orphaned objects under interruption. |
| High | `server.ts` domain block 4825-5015 | Cloudflare provisioning and Firestore state mutation are synchronous. | External provider timeout can leave ownership/status partially updated. |
| High | `server.ts` integrations/calendar blocks 4638-4823 | OAuth state, token exchange, encryption, provider calls, and persistence are inline. | Credential lifecycle and provider-specific behavior leak into transport code. |
| High | `worker.ts` imports `{ backgroundJobs, outbox } from './server'` | Worker boots the full Express application composition. | Worker deployment inherits HTTP route initialization, config, side effects, and memory footprint. |
| High | `server/adapters/cloudflare.ts`, `server/adapters/stripe.ts` | Adapters import implementation functions from `server-services.ts`, which is also a composition/legacy module. | Dependency direction is inverted; adapter tests cannot isolate provider behavior cleanly. |
| High | `server/domains/*/index.ts` | Several domain module factories instantiate Firestore repositories directly. | Composition and domain module boundaries are blurred; PostgreSQL swapping requires module edits. |
| Medium | `server-calendar.ts` and `server.ts` | Calendar adapter/configuration is shared by OAuth routes and worker-like sync code. | Provider token refresh and event synchronization cannot be independently retried. |
| Medium | `server.ts` account export 3469-3591 | One export traverses profile, sites, analytics, products, media, orders, integrations, and domains. | Cross-domain export becomes a hidden coupling/API contract and can overload the datastore. |
| Medium | `server.ts` readiness 3230-3258 | Readiness validates providers but not schema migration version or worker/outbox health. | A release can appear ready while migration assumptions are unmet. |
| Medium | `server/background-jobs` handlers registered in `server.ts` | Several handlers are no-ops (`order_processing`, `domain_verification`, `oauth_refresh`, `analytics_rollup`). | The job platform contract exists, but actual workflow ownership is incomplete. |

## Exact refactor/move plan

These are code-movement targets, not behavior changes to perform in this audit.

### Phase 1: composition and transport seams

1. Move `server.ts` bootstrap/config/middleware into `server/app.ts`; leave route behavior unchanged.
2. Move route declarations into `server/http/routes/<context>.ts` using the current handlers as temporary controller functions.
3. Move shared auth extraction (`getAuthenticatedUser`, session parsing, bearer verification) into `server/http/auth.ts` and policy calls into `server/core/authorization-policy.ts`.
4. Move error/validation/idempotency/rate-limit helpers out of `server.ts` into `server/core` modules.
5. Make `worker.ts` compose from `server/worker/composition.ts`, not from `server.ts`.

### Phase 2: highest-risk domain slices

| Route block | Move/refactor target | First interface |
| --- | --- | --- |
| 1967-2158 | `server/domains/bookings/controller.ts`, `application-service.ts`, `repositories/*` | `BookingApplicationService.create/confirm/cancel/list`, calendar/notification ports |
| 4321-4535 | `server/domains/orders/controller.ts`, `checkout-service.ts`, `fulfillment-service.ts` | `OrderService`, `InventoryService`, `PaymentProvider`, outbox transaction |
| 4186-4310 | `server/domains/products/controller.ts`, `catalog-service.ts` | Catalog repository + Stripe product adapter |
| 4537-4636 | `server/domains/billing/controller.ts`, subscription service | Billing webhook/application service + entitlement port |
| 3727-3887 | `server/domains/media/controller.ts`, media service/worker | Media metadata/storage/processing ports |
| 4825-5015 | `server/domains/domains/controller.ts`, provisioning application service | Domain repository + Cloudflare provisioning adapter |
| 4638-4823 | `server/domains/integrations/controller.ts`, OAuth/calendar services | Integration repository + OAuth/provider ports |

### Phase 3: lower-risk/read-heavy slices

- Move `3952-4184` to sites/publishing controllers and route all public reads through `publicCreatorAdapter`.
- Move `2308-2560` to audience service/controllers with email intent events.
- Move `2562-2619` and `3593-3725` to analytics ingestion/dashboard services.
- Move account/profile/session routes `2621-3467` into identity/account services, preserving Firebase Auth as the identity provider.
- Move `1654-1737` into a publishing/SEO controller with a published-site repository/cache interface.

### Persistence/provider moves

- Move all `adminDb` calls out of `server.ts` and `server-services.ts` into the existing repository contracts and new domain-specific repositories.
- Move inline Stripe calls from `server.ts`/`server-services.ts` behind `PaymentProvider`, `BillingProvider`, and product/catalog adapter contracts.
- Move Cloudflare calls behind `DomainProviderAdapter`; remove `server/adapters/cloudflare.ts -> server-services.ts` inversion.
- Move GitHub OAuth into the integrations adapter set; remove inline calls around `787-850`.
- Make `server/adapters/email.ts` the only email provider entrypoint; route notification jobs through it.
- Split `server-calendar.ts` into configuration, OAuth adapter, and calendar event adapter files while keeping the current public contract.
- Add a concrete analytical-store adapter when BigQuery is provisioned; currently the pipeline defines ports but no visible production sink.

## Migration risks and controls

| Risk | Control |
| --- | --- |
| Route behavior changes during extraction | Characterization tests, API contract tests, shadow responses, and route-by-route strangler flags. |
| Firestore/PostgreSQL divergence | Stable IDs, dual reads/writes, normalized comparison, migration checkpoints, checksums, and reconciliation reports. |
| Stripe/provider side effects duplicated | Provider idempotency keys, webhook event claims, outbox events, and adapter contract tests. |
| Booking double reservation | Database constraints/transactions in the target plus source lock equivalence tests before cutover. |
| Worker duplicate delivery | Existing job IDs/leases/dead-letter handling; move handlers without changing idempotency keys. |
| Public cache leaking private data | Keep public adapter payload schema separate and invalidate only on publication/domain changes. |
| Auth/authorization regression | Central policy tests for tenant/site ownership and authenticated/unauthenticated route matrices. |
| Worker startup regression | Independent worker composition test and `/health`/task smoke tests without importing Express. |
| Account export becoming a distributed transaction | Per-domain export contracts, bounded pagination, and asynchronous export jobs. |
| Next.js migration overreach | Keep Vite Studio and compatibility public renderer until a real Next app passes shared-schema and staging evidence. |

## Recommended order of execution

1. Characterize current routes and provider side effects; do not change public contracts.
2. Extract worker composition and email/calendar/media job handlers from `server.ts`.
3. Extract orders/inventory/checkout and bookings because they carry the highest consistency risk.
4. Extract billing/integrations/domains because external-provider failure handling is sensitive.
5. Extract sites/publishing/audience/analytics/media reads and cache boundaries.
6. Enable PostgreSQL domain by domain through the strangler router and feature flags.
7. Introduce the Next.js public renderer only after the published-site adapter is the stable source contract.

## Audit conclusion

The repository has the right target abstractions and operational scaffolding, but the legacy compatibility shell is still the dominant architecture. The next architectural value comes from moving behavior behind the already-defined interfaces, especially worker composition, bookings, commerce, billing, and external-provider workflows. No microservice extraction or broad frontend rewrite is justified by this inventory alone.
