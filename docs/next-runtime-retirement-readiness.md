# Next.js runtime retirement readiness

Status: **blocked — do not remove Express or Vite yet**

The Next.js application is a foundation and migration boundary, not yet a complete replacement for the current Express API and Vite application. The legacy runtimes must remain available until the parity evidence below is complete.

## Current runtime ownership

| Surface | Current authority | Next.js status | Retirement requirement |
| --- | --- | --- | --- |
| Public creator pages | Express fallback/Vite `PublicCreatorProfile` and `PublicPageApp`; Next `/(public)/[handle]` is a new path | Partial | Compare published payloads, block rendering, metadata, custom domains, forms, bookings, products, and media |
| Landing page | Vite `App.tsx` and its component tree | Partial placeholder | Migrate or explicitly retire every section and interaction: templates, pricing, FAQ, newsletter, attribution, locale, theme, auth entry points |
| Studio | Vite `StudioModal` and existing components; Next mounts a bridge | Partial bridge | Validate all Studio workflows and replace Vite-only navigation/state assumptions |
| Authentication | Express routes plus Firebase client/AuthContext; Next has login/register pages and session/logout handlers | Partial | Prove signup, login, OAuth, reset, verification, session expiry, logout, and error parity |
| API | Express `server.ts` | Partial | Every route must have a documented Next route handler/server action replacement or an approved removal record |
| Background/internal APIs | Express `server.ts` and worker entrypoints | Not migrated | Move/repoint task, outbox, reconciliation, and metrics endpoints without changing operational behavior |
| Static/SEO endpoints | Express robots, sitemap, llms; Next robots/sitemap | Partial | Compare content, cache behavior, custom-domain behavior, and crawler responses |

## API inventory comparison

Express currently exposes route families for:

- health/readiness, robots, sitemap, and llms
- handle checks/reservation and public scheduling/bookings
- creator bookings and audience management/export
- public newsletter/contact/telemetry
- auth registration, login, logout, password reset, OAuth, session, and email verification
- account sessions, profile, preferences, billing, referrals, deletion, and export
- platform analytics
- media upload, completion, listing, URLs, deletion, cleanup, and public access
- creator products, public products/checkout, orders, and fulfillment
- billing activation, checkout, portal, and checkout-session lookup
- referrals
- integrations and calendar OAuth/refresh/disconnect
- domains, provisioning, verification, and removal
- internal background jobs, calendar reconciliation, domain verification, outbox, and metrics

Next currently has route handlers for:

- `/api/auth/logout`
- `/api/auth/session`
- `/api/v1/health`

Therefore the API inventory is not equivalent and the Express server cannot be retired.

## Vite route/component inventory

The Vite shell still resolves these routes and behaviors in `src/App.tsx` and related components:

| Route/behavior | Implementation | Next status |
| --- | --- | --- |
| `/` | Landing sections, authenticated home, auth modal entry, locale/theme | Partial |
| `/templates` | `TemplatesPage`, template gallery and preview modal | Missing |
| `/login`, `/register` | Auth modal route compatibility | Separate Next pages exist; behavior parity unverified |
| `/forgot-password`, `/reset-password` | Auth modal/reset flow | Missing parity tests |
| `/features`, `/pricing`, `/guides`, `/about`, `/contact` | Landing section routing | Missing |
| `/@handle` | `PublicCreatorProfile` | Next dynamic handle page exists; feature parity unverified |
| `/public-render/:handle` | Public rendering compatibility path | Missing |
| `/studio` | `StudioModal` and authenticated editor | Bridge exists; full workflow parity unverified |
| `ssl_error=526` | `InvalidSslFallback` | Missing |
| `#404` and unknown paths | `NotFound` behavior | Partial |

## Required equivalence evidence

Before retirement, produce a versioned report containing:

1. A route-by-route API mapping with response/error/status compatibility.
2. A Vite-to-Next component mapping, including intentional removals and product approval.
3. Functional equivalence tests for auth, site creation/edit/autosave/publish, public rendering, media, bookings, audience, products/orders, billing, domains, analytics, integrations, and settings.
4. Browser tests covering mobile, RTL, loading, unauthorized, forbidden, empty, provider failure, and retry states.
5. API contract and provider contract suites passing against Next handlers.
6. Production-like shadow traffic or comparison results with no unexplained differences.
7. A rollback plan proving that traffic can be restored during the observation window.
8. A dependency report identifying packages used only by the retired Vite/Express paths.

## Retirement sequence

1. Finish Next route/API/component parity and publish the comparison report.
2. Route controlled traffic to Next using a feature flag or deployment boundary.
3. Observe errors, latency, provider failures, auth/session behavior, and public rendering for the agreed window.
4. Freeze legacy changes and run the complete regression suite.
5. Remove Express only after no production route, worker, or deployment manifest depends on it.
6. Remove the Vite runtime only after all required components and entry points are served by Next.
7. Remove dead compatibility code and dependencies, then rerun typecheck, build, API checks, unit/integration/contract/E2E suites, and smoke tests.

No legacy runtime or compatibility code is deleted by this readiness change.

