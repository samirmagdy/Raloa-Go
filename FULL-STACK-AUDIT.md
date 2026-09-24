# RALOA Full-Stack Audit

Date: 2026-09-24

Scope: React/Vite frontend, Express server, Firebase Auth/Firestore integration, Stripe billing, Cloudflare custom domains, security rules, Docker/runtime configuration, tests, and release readiness.

## Executive summary

The repository compiles and the existing local verification suites pass, but the application is not ready for a multi-instance paid production launch. The most important blockers are:

1. The production Docker image does not copy `src/data/content.ts`, although `server.ts` imports it at runtime.
2. Authentication sessions, local users, password-reset tokens, rate limits, and contact submissions are process-local memory stores.
3. The password-reset endpoint returns the reset token in its JSON response and has no production email delivery path.
4. Custom-domain provisioning accepts a client-supplied `siteId` without verifying ownership.
5. Server-side feature enforcement is incomplete; only the free link limit is enforced in Firestore rules.
6. SSR metadata interpolates creator-controlled strings into HTML without escaping.

The quality gates currently prove local behavior, not production behavior. `npm run lint`, `npm run build`, `test-entrypoint.ts`, and `test-modules-2-4.ts` pass, but the build still reports a large main bundle and the tests do not exercise Cloud Run, Firebase Admin, Stripe, or Cloudflare with production-like persistence.

## Severity model

- **P0**: blocks safe production launch or can cause outage/security compromise.
- **P1**: serious correctness, authorization, billing, or data-integrity risk.
- **P2**: material reliability, performance, accessibility, or maintainability issue.
- **P3**: polish or follow-up improvement.

## Findings

### P0 — Production Docker image is incomplete

Evidence:

- `server.ts` imports `templatesData` from `./src/data/content`.
- `Dockerfile` copies `server.ts`, `server-services.ts`, `index.html`, and `firebase-applet-config.json`, but does not copy `src/`.
- The runtime command is `npx tsx server.ts`, so the import is resolved when the container starts.

Impact: the Cloud Run container can fail during startup with a missing-module error. This is a release-blocking deployment failure.

Root fix: build a runtime artifact that contains every server import, or copy the required server-side source/data into the runtime image. Add a container smoke test that starts the image and calls `/api/health` before deployment.

### P0 — Password reset is not production-safe

Evidence:

- `POST /api/v1/auth/forgot-password` stores tokens in `PASSWORD_RESET_TOKENS`, an in-memory `Map`.
- It returns `token` directly in the response body.
- `src/lib/firebase.ts` falls back to this endpoint after any Firebase reset failure, without restricting the fallback to localhost.
- The endpoint has no email delivery, durable token record, single-use persistence across instances, or generic response for account enumeration protection.

Impact: anyone who can call the endpoint can receive a valid reset credential for an account that uses the local store; a restart or second instance invalidates outstanding tokens; production users may see a false success without receiving an email.

Root fix: remove the local reset endpoint from production, use Firebase Auth reset emails as the only production path, or implement a durable, hashed, single-use token workflow with email delivery, generic responses, expiry cleanup, and distributed rate limiting. Never return the raw reset token to the browser.

### P0 — Authentication and security state are process-local

Evidence:

- `ACTIVE_SESSIONS`, `USERS_DB`, `LOGIN_ATTEMPTS`, `FORGOT_PW_RATE_LIMITS`, `CONTACT_RATE_LIMITS`, and `PASSWORD_RESET_TOKENS` are in-memory stores in `server.ts`.
- The Docker/Cloud Run deployment is designed to scale across revisions and instances.
- `/studio` route protection checks only `ACTIVE_SESSIONS` cookies.

Impact: users can be logged out when an instance restarts, sessions are not shared between instances, rate limits can be bypassed by changing instances, contact data can be lost, and a revision rollback does not preserve session state.

Root fix: use Firebase Auth ID tokens or a signed, verifiable session cookie backed by Firebase Admin; persist business/security records in Firestore or a distributed store; use a managed rate limiter and durable contact ingestion. Keep local auth fixtures behind an explicit test-only mode.

### P1 — Custom-domain provisioning has an authorization gap

Evidence:

- `POST /api/domains/provision` accepts `siteId` from `req.body`.
- It checks the caller’s plan but does not load the requested site and verify that it belongs to `user.uid`.
- The domain record is saved with that unverified `siteId`.
- Active routing rewrites the hostname to `/@${siteId}`.

Impact: a paid user can attach a custom domain to another creator’s handle/site, potentially exposing or hijacking another user’s public identity.

Root fix: resolve the requested site from `users/{uid}/sites/{siteId}`, require ownership and publication state, use a server-derived site ID, and add an authorization test for cross-user site IDs. Add a uniqueness transaction for hostname claims.

### P1 — SSR metadata is vulnerable to HTML injection

Evidence:

- `server.ts` inserts `creator.name`, `creator.bio`, and `creator.avatar` into `<title>` and meta tags using string replacement.
- Published creator data is user-controlled.

Impact: crafted creator content can break the document or inject markup into server-rendered HTML. CSP currently permits `'unsafe-inline'` and `'unsafe-eval'`, reducing defense in depth.

Root fix: escape HTML attribute/text content before interpolation, or generate metadata through a safe serializer/template. Add tests using quotes, angle brackets, and ampersands in creator fields. Remove unsafe CSP directives where the app allows it.

### P1 — Paid feature gates are not server-authoritative

Evidence:

- `src/lib/planCapabilities.ts` defines premium templates, analytics, branding, domains, and studio controls.
- Firestore rules enforce only the free `links.size() <= 10` limit.
- No server/domain/API enforcement exists for premium template IDs, media limits, branding removal, analytics access, or studio-only controls.
- `saveMiniSite` writes a broad site object directly to Firestore.

Impact: a client can write premium fields or use premium capabilities by bypassing the UI. Pricing promises and actual access can diverge.

Root fix: centralize capabilities in a server/rules-compatible policy; validate plan and field changes on a trusted server endpoint or in hardened rules; make webhook-synchronized billing state authoritative; test each plan against allowed and denied operations.

### P1 — Stripe checkout can create duplicate customers/subscriptions

Evidence:

- `createCheckoutSession` always passes `customer_email` and does not reuse the stored `stripeCustomerId`.
- There is no check for an existing active subscription before creating another checkout session.

Impact: repeated clicks, retries, or upgrades can create duplicate Stripe customers and active subscriptions, producing double charges and ambiguous entitlement state.

Root fix: create/reuse one Stripe customer per user, use an idempotency key for checkout creation, block or explicitly model an existing subscription, and route changes through the Billing Portal or a server-owned subscription-update flow.

### P1 — Stripe webhook idempotency is race-prone

Evidence:

- The handler reads `stripe_events/{event.id}`, then writes `status: processing`, then performs side effects.
- Two concurrent deliveries can both observe no processed event and both apply the event.

Impact: duplicate entitlement updates or repeated side effects during webhook retries/concurrency.

Root fix: claim events atomically in a transaction/create operation, store the result, and make every downstream update idempotent. Add concurrent replay tests and failure/retry tests.

### P1 — Readiness checks can report false readiness

Evidence:

- `APP_URL` has a localhost fallback, so `Boolean(APP_URL)` is true even when production configuration is missing.
- `isAdminConfigured()` returns true when `K_SERVICE` exists, without explicitly verifying Firebase Admin credentials or a Firestore read.
- Readiness checks only booleans; they do not verify Firestore, Stripe price IDs, webhook secret, or Cloudflare connectivity.

Impact: Cloud Run can receive traffic while required dependencies are unavailable or misconfigured.

Root fix: fail fast on required production configuration, perform bounded dependency probes in readiness, and distinguish liveness from readiness. Never use localhost defaults in production.

### P1 — Forwarded headers and IP identity are trusted without a proxy policy

Evidence:

- Canonical redirects use `x-forwarded-proto` and host resolution directly.
- Contact and login throttles use the first `x-forwarded-for` value.
- Express proxy trust is not configured.

Impact: clients can spoof IPs to bypass throttles or influence redirect/host behavior unless an upstream proxy strips and rewrites these headers exactly.

Root fix: configure trusted proxy hops explicitly, derive client identity only from trusted infrastructure, normalize host/proto values, and test spoofed headers.

### P1 — Data features are split between nonfunctional client writes and local-only state

Evidence:

- `saveBookingAppointment` and `saveStoreOrder` write directly to collections whose rules deny all writes.
- Studio audience data is stored in `localStorage`.
- Telemetry writes directly from the client to Firestore and silently ignores failures.

Impact: bookings/orders cannot complete through the current data path; audience data is device-local; analytics can be silently incomplete and is vulnerable to client-generated noise.

Root fix: either remove unfinished capabilities from production UI or implement authenticated/server endpoints, schemas, ownership checks, validation, and durable processing. Make telemetry write-only through a bounded server ingestion path with abuse controls.

### P2 — Production bundle remains oversized

Evidence:

- `vite build` passes but reports `index` at approximately 783 kB minified and Firebase at approximately 552 kB minified.
- Studio, Firebase, and several heavy modules are still reachable from the main application graph.

Impact: slower first load, especially on mobile networks, and weaker Core Web Vitals.

Root fix: lazy-load Firebase/authenticated surfaces and heavy Studio modules, audit shared imports, and set a performance budget enforced in CI.

### P2 — Frontend type safety is weakened by broad `any` usage

Evidence:

- `src/types.ts` defines `UserMiniSite.links` as `any[]`.
- Auth, Studio, domain, analytics, and integration paths use repeated `any` casts.

Impact: malformed persisted data and API contract drift are discovered at runtime instead of compile time.

Root fix: define shared DTOs and discriminated unions for links, domains, API errors, and Studio settings; validate unknown API payloads at boundaries.

### P2 — Existing tests do not cover the production integration boundary

Evidence:

- The custom suites pass using local in-memory stores and fixture data.
- There is no Firebase Emulator Suite test configuration, Stripe webhook signature/replay suite, Cloudflare contract test, container startup test, or browser-level responsive/accessibility suite in `package.json`.

Impact: deployment, persistence, billing, domain routing, and mobile regressions can pass CI unnoticed.

Root fix: add emulator-backed rules/integration tests, Stripe test-mode fixtures, Cloudflare mocked contract tests, Docker smoke tests, and Playwright/browser checks at 320/375/430/768/1280/1440 widths plus keyboard and RTL flows.

### P3 — Release configuration is documented but not enforced

Evidence:

- `docs/GO_LIVE.md` lists required secrets, but `.env.example` still contains localhost/default values and no automated configuration validation.
- The repository has no CI workflow or pre-deploy gate visible in the tracked files.

Impact: releases depend on manual operator discipline and can ship with incomplete secrets or unverified rules/indexes.

Root fix: add a non-secret configuration validator, CI quality gates, deployment smoke tests, and an explicit production environment checklist.

## What passed

- `npm run lint` — passed (`tsc --noEmit`).
- `npm run build` — passed; large-chunk warning remains.
- `npx tsx test-entrypoint.ts` — passed, 16/16 checks.
- `npx tsx test-modules-2-4.ts` — passed.
- Existing Firestore rules are restrictive for several collections and protect plan/billing fields from direct client updates.
- Stripe webhook signatures are verified before processing.
- Public creator routes, canonical redirects, basic security headers, handle validation, and local auth flow have automated coverage.

## Recommended remediation order

1. Fix the Docker runtime image and add a startup smoke test.
2. Remove production local-auth/password-reset fallbacks and eliminate raw reset-token responses.
3. Replace process-local sessions, rate limits, contact storage, and user persistence with durable production services.
4. Close custom-domain site ownership and hostname uniqueness gaps.
5. Add safe SSR escaping and tighten CSP.
6. Implement server-authoritative plan capability enforcement.
7. Make Stripe customer creation and webhook processing idempotent.
8. Make readiness dependency-aware and fail closed on missing production configuration.
9. Decide which bookings/orders/audience features are launch scope; complete them or remove their promises/UI.
10. Add emulator, integration, container, browser, accessibility, and performance gates.

## Launch decision

**Do not launch the paid production service yet.** The current code is suitable for continued local development and UI iteration, but P0 and P1 findings affect deployment startup, credential recovery, session durability, authorization, billing correctness, and entitlement enforcement.

## Remediation update — 2026-09-24

The following root-cause changes were implemented after this audit:

- Docker runtime now includes the server-side `src/` tree and has a container health check.
- Production auth sessions use signed, stateless cookies with a required `AUTH_SESSION_SECRET`; local in-memory sessions remain test/development-only.
- Production password-reset endpoints are disabled in favor of Firebase Auth email reset, and the client no longer falls back to the local reset endpoint outside localhost.
- Firestore-backed rate-limit buckets cover production login, contact, and reset flows; contact, newsletter, booking, and order submissions persist through server endpoints.
- Custom-domain provisioning verifies the caller owns and has published the requested site, reserves hostnames transactionally, and uses deterministic domain IDs.
- SSR creator metadata is HTML-escaped and the CSP no longer permits `unsafe-eval` or inline scripts.
- Stripe checkout reuses/creates one customer per user and uses idempotency keys; webhook event claims are transactionally guarded.
- Readiness now validates production URL, session secret, Stripe catalog/webhook configuration, Cloudflare configuration, and a Firestore read.
- Firestore rules now prevent free users from writing custom domains, branding removal, analytics IDs, and webhooks.
- A `validate:production` configuration gate was added and documented in the go-live runbook.

Remaining release work is operational rather than silently assumed complete: provision real production secrets and Firebase/Stripe/Cloudflare accounts, deploy and verify Firestore rules/indexes, add emulator-backed security tests, run browser/mobile accessibility tests, and reduce the still-large frontend bundle. The code checks pass locally, but these external environment checks still require the production accounts and deployment pipeline.
