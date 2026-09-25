# RALOA Backend Review & Audit

Audit date: 2026-09-24  
Scope: Express server, Firebase client/Admin integration, Firestore rules/indexes, Stripe and Cloudflare seams, API consumers, tests, and backend handoff readiness.

## Executive result

The implementation pass closed the data-access, public-mutation, handle, authentication-gating, error-contract, telemetry, analytics, and API-surface findings. TypeScript, production compilation, the existing route suites, and the API contract gate now pass. The remaining release work is operational rather than an unprotected backend path: emulator-backed rules tests, live Stripe/Cloudflare smoke tests, browser QA, and the final mobile bundle budget.

Resolution status:

1. Firestore referral-code and public ingestion collections are server-write-only.
2. Contact, newsletter, telemetry, bookings, and orders use bounded server endpoints; bookings/orders require idempotency keys.
3. Handles are reserved and updated in one Admin transaction; client profile updates cannot mutate handles or entitlements.
4. Site saves, plans, analytics, and referrals use authenticated/server-owned seams.
5. API errors are normalized at the response boundary and a typed client handles both legacy and structured responses.
6. Local authentication is explicit-gated for non-production environments; production-like environments cannot use the fallback stores.

## Architecture inventory

- Runtime: Express 4 + TypeScript executed with `tsx`.
- Persistence: Firebase Admin Firestore in server code; Firebase Web SDK in the client.
- Authentication: Firebase ID-token verification plus signed production session cookies; local in-memory auth fixtures outside production.
- Billing: Stripe Checkout, Billing Portal, and webhook handler.
- Custom domains: Cloudflare custom-hostname API plus Firestore records.
- Public route declarations: 33 `app.get/post/delete` declarations in `server.ts`, including marketing/static/catch-all routes; 29 are API or service routes.
- Contract layer: `docs/api/endpoints`, `docs/api/openapi.yaml`, `src/api/client.ts`, and local fixtures under `src/api/mock/`.

## Findings

### P0 — Firestore direct-write policy bypasses server controls

Status: **RESOLVED**. Rules now deny client writes and browser ingestion routes through rate-limited server endpoints.

Evidence:

- `firestore.rules:65-75` allows anonymous `create` to `contacts` and `newsletter_subscribers`.
- `firestore.rules:79-88` allows anonymous `create` to `page_views` and `link_clicks`.
- `server.ts:995-1051` has a server contact endpoint with IP rate limiting, but direct client Firestore writes do not pass through it.
- `src/lib/firebase.ts:584-590` still exposes `saveContactMessage()` as a direct Firestore write.
- `src/lib/firebase.ts:736-766` writes telemetry directly from the browser.

Impact: a caller can bypass the server’s validation/rate limiting and generate unbounded Firestore writes or spam. This creates cost, data-quality, and abuse risk.

Root fix: make public collections server-write-only (`allow create: if false`) and route contact, newsletter, page-view, and click ingestion through bounded server endpoints. Add per-event payload limits, origin/abuse controls, and a durable retention policy.

### P1 — Referral-code collection leaks owner identity

Status: **RESOLVED**. Client reads/writes are denied; qualification resolves a supplied handle on the authenticated server.

Evidence: `firestore.rules:58-63` permits any signed-in user to read every `referral_codes` document, whose data includes `userId` (`src/lib/firebase.ts:149-156`).

Impact: authenticated users can enumerate referral-code documents and map codes to internal Firebase user IDs. The browser only needs lookup/qualification for a supplied code, not collection-wide read access.

Root fix: deny client reads and perform referral-code lookup only in the authenticated server qualification endpoint, or expose a narrowly scoped public lookup document that contains no owner UID.

### P1 — Plan capability enforcement is incomplete and inconsistent

Status: **RESOLVED for the identified write bypasses**. Site writes now use an authenticated server endpoint, Firestore validates profile/site/link shape, paid fields remain server-gated, and referral rewards no longer mutate plan from the browser. Remaining capability expansion should be added to the shared policy before advertising new features.

Evidence:

- `src/lib/planCapabilities.ts:15-42` defines premium templates, media, analytics, branding, domains, and studio controls.
- `firestore.rules:18-31` limits links and several paid fields, but does not validate premium template IDs, media count/types, analytics access, studio-only fields, or link object shape.
- `src/lib/firebase.ts:543-559` writes a broad mini-site object directly from the client.

Impact: a client can write data that the UI would normally restrict, and the pricing promise can diverge from the trusted data layer. `paidPlan()` also does not apply the referral expiry rule used by `hasPaidPlan()` in `server.ts:493-496`.

Root fix: define one server/rules-compatible capability policy, validate all write fields and nested link objects at the publish boundary, and enforce referral expiry identically in Firestore and server code. Add allow/deny tests for every plan capability.

### P1 — Public bookings and orders lack resource validation, abuse controls, and idempotency

Status: **RESOLVED for the identified API controls**. Published-host validation, rate limits, mandatory idempotency keys, replay handling, and server-side pending state are now enforced. Payment confirmation and calendar-slot locking remain launch prerequisites for enabling real booking/order fulfillment.

Evidence:

- `server.ts:937-973` accepts public booking/order submissions.
- Booking validation checks only string/date/email shape; it does not verify that `hostHandle` maps to a published site or that the requested slot is available.
- Order validation accepts one hard-coded title and writes a new pending order without an idempotency key, payment confirmation, or inventory state.
- Neither endpoint has a rate limit or replay protection.

Impact: attackers can create arbitrary pending bookings/orders, duplicate submissions, and fill Firestore with unprocessable records.

Root fix: resolve the host/product from trusted server data, validate ownership and availability, require an idempotency key, add abuse/rate limiting, and make payment/order state transitions server-authoritative.

### P1 — Handle ownership and uniqueness are not enforced end to end

Status: **RESOLVED**. Reservation/profile updates are one Admin transaction, exact handle validation is server-side, and direct client handle mutation is denied.

Evidence:

- `firestore.rules:12-16` accepts an arbitrary `handle` string in a user profile and does not enforce its format or uniqueness.
- `firestore.rules:39-41` does not protect `handle` from client updates.
- `server.ts:912-934` reserves a handle in `handles`, then updates `users/{uid}` in a separate write.
- `src/lib/firebase.ts:397-408` can sync a client-provided `customData.handle` directly to the profile.

Impact: a user can change a handle without updating the reservation record, create profile/reservation drift, or race another claim. Public routing and referral links can become ambiguous.

Root fix: make handle changes a single server transaction over the reservation and profile records, validate the exact format/reserved list server-side, and prevent direct client handle mutation.

### P1 — Error contracts are not stable or centralized

Status: **RESOLVED at the transport boundary**. Error responses are normalized with stable `code`, `message`, and optional `fields`; internal checkout details are logged server-side only. Individual legacy handlers can still be migrated to `apiError` incrementally.

Evidence: API handlers return several incompatible shapes, including `{ status, message }`, `{ error: string }`, `{ status, error, message, retry_after }`, and raw internal messages (`server.ts:995-1051`, `server.ts:1611-1735`). The global handler returns `{ error: 'Internal server error', requestId }` (`server.ts:2073-2085`).

Impact: clients must branch on message text and cannot reliably distinguish validation, authorization, conflict, dependency, and retryable failures. Some Stripe configuration errors are passed through as server error strings (`server.ts:1641-1645`).

Root fix: introduce one typed application error and one mapper with `{ error: { code, message, fields? }, requestId }`; make every handler use stable codes and avoid exposing internal configuration names.

### P1 — Production-like environments can still expose local authentication/reset behavior

Status: **RESOLVED for environment exposure**. Local auth is now enabled only in tests or with explicit `LOCAL_AUTH_ENABLED=true`; staging/preview/production are disabled by default, and production-like reset responses cannot expose the local token.

Evidence:

- Local stores are defined in `server.ts:366-418` and `server.ts:451-526`.
- Password reset creates a raw token in `PASSWORD_RESET_TOKENS` and returns it in JSON at `server.ts:1281-1323`.
- Email verification is unauthenticated and mutates the local user store at `server.ts:1528-1543`.
- The server disables these paths only when `NODE_ENV === 'production'`.

Impact: a staging or misconfigured Cloud Run environment can expose test accounts, process-local credentials, and unauthenticated verification mutation. Restarting an instance loses reset/session state.

Root fix: gate all local auth fixtures behind an explicit `LOCAL_AUTH_ENABLED=true` plus localhost/test checks, remove the raw reset-token response, and use Firebase Auth reset/verification flows for every non-test environment.

### P1 — Proxy-derived host and client IP trust needs an explicit deployment policy

Status: **RESOLVED in application policy**. Trusted proxy hops are configured through `TRUSTED_PROXY_HOPS`, forwarded headers are ignored when hops are zero, and malformed hosts are rejected before redirects/routing.

Evidence:

- `server.ts:570-575` accepts the first `x-forwarded-host` value.
- `server.ts:582-593` builds canonical redirects from forwarded host/proto.
- `server.ts:996-1003` and `server.ts:1140-1148` use request IPs for controls.
- `server.ts:32` sets `app.set('trust proxy', 1)` without documenting the trusted hop or enforcing an allowlist.

Impact: if Cloud Run/Cloudflare does not strip and rewrite these headers exactly, clients can spoof redirect hosts or evade IP-based throttles.

Root fix: document and test the exact trusted proxy chain, reject unexpected forwarded hosts/protocols, and use an infrastructure-provided client identity only after trusted proxy normalization.

### P2 — API contract and frontend handoff are missing

Status: **RESOLVED as a contract-surface gap**. All discovered routes have endpoint documents, `docs/api/openapi.yaml`, `src/api/client.ts`, fixtures, and an npm `check:api` gate. Endpoint documents remain marked `planned` until each receives a dedicated captured contract test.

Evidence:

```text
node /Users/samirmagdy/.agents/skills/backend-first/scripts/api-contract-check.mjs \
  --root . --src server.ts,server-services.ts \
  --docs docs/api --openapi docs/api/openapi.yaml

ERRORS (1):
  x no endpoint docs dir at docs/api/endpoints — every route needs a contract doc there
WARNINGS:
  ! no routes discovered
  ! no openapi.yaml found
FAIL — 1 error(s) — 0 contract doc(s), 0 pending, 0 route(s), 0 spec operation(s)
```

Impact: route behavior, auth, validation, error mapping, and response types were not a trusted frontend contract. The project-specific invocation now scans the complete source tree and reports 36 routes / 36 OpenAPI operations.

Root fix: document every implemented route with real curl evidence, add the OpenAPI spec, typed client modules, fixtures/mocks, and a CI `check:api` command. Fix scanner discovery before treating the gate as meaningful.

### P2 — Integration and security tests do not cover production boundaries

Evidence:

- `package.json` contains no emulator, browser, API-contract, or integration test script.
- Existing tests use local in-memory stores (`test-entrypoint.ts`, `test-modules-2-4.ts`).
- No Firebase Emulator Suite configuration, Firestore rules test, Stripe signature/replay test, Cloudflare contract test, or browser accessibility test is present.

Impact: the passing suite does not prove durable persistence, rules behavior, webhook replay, multi-instance sessions, domain automation, or responsive/authenticated browser flows.

Root fix: add emulator-backed rules tests, Stripe test-mode fixtures/replay tests, Cloudflare mocked contract tests, a container smoke test, and browser tests for auth, publish, billing, domains, mobile, keyboard, and RTL.

### P2 — Telemetry is client-trusted and unbounded

Status: **RESOLVED for ingestion control**. Browser telemetry now posts to bounded server endpoints with normalized payloads and rate limits; Firestore client writes are denied. Retention and aggregation remain an operations task.

Evidence: `firestore.rules:79-88` and `src/lib/firebase.ts:736-766` accept browser-supplied path, URL, user agent, link ID, and site handle with only basic length checks.

Impact: analytics can be forged, polluted, or used to create cost at scale; there is no server-side ownership validation or retention policy.

Root fix: ingest through a server endpoint with rate limiting, normalized fields, origin/site validation, sampling, and retention/aggregation controls.

### P2 — Production bundle remains above the current performance budget

Status: **OPEN**. Firebase, Studio, and motion are chunked, but the application entry chunk remains large. This is the only code-quality finding from this report that still needs a dedicated performance pass.

Evidence: `npm run build` reports `index` at approximately 783 kB minified and Firebase at approximately 552 kB minified.

Impact: first-load cost remains high for mobile visitors, especially before authentication or Studio is needed.

Root fix: split Firebase/authenticated Studio code from the marketing route, add a CI bundle budget, and verify Core Web Vitals on representative mobile profiles.

## Verified strengths

- `npm run lint` passed (`tsc --noEmit`).
- `npm run build` passed; large-chunk warning remains.
- `npx tsx test-entrypoint.ts` passed 17/17 checks.
- `npx tsx test-modules-2-4.ts` passed all listed cases.
- Live local checks returned:
  - `GET /api/health` → `200 {"status":"ok","service":"raloa",...}`
  - `GET /api/v1/handles/check?handle=launch-test` → `200 {"status":"success","data":{"handle":"launch-test","available":true}}`
  - `GET /api/readiness` in development → `200 {"status":"ready","environment":"development"}`
  - Unknown marketing route → `404` with `X-Robots-Tag: noindex, nofollow`
- Production readiness checks exist in `server.ts:1549-1577` and configuration validation exists in `scripts/validate-production-env.mjs`.
- Stripe webhook signatures are verified and event claims are transactionally guarded in `server-services.ts:216-282`.

## Recommended order

1. Close Firestore direct-write and referral-code exposure.
2. Add one error envelope and explicit request validation layer.
3. Make handles, sites, bookings, orders, referrals, billing, and domains server-owned seams.
4. Remove/gate local auth and reset behavior outside explicit test mode.
5. Add emulator/integration tests and endpoint contracts/OpenAPI.
6. Add bundle/performance and browser-flow gates.

## Launch decision

The identified backend code blockers are closed. Do not call the product fully production-ready until the operational gates below are completed with real services:

- deploy and exercise Firestore rules in the Emulator Suite;
- run Stripe test-mode Checkout, Portal, webhook replay, cancellation, and failed-payment flows;
- run Cloudflare custom-hostname verification/SSL/routing tests;
- add browser accessibility/mobile/RTL coverage;
- complete the remaining entry-chunk performance pass.

The contract gate is now structurally healthy: `npm run check:api` reports 36 endpoint documents, 36 routes, and 36 OpenAPI operations. Its warnings are explicit unproven-contract warnings, not route drift or missing documentation.
