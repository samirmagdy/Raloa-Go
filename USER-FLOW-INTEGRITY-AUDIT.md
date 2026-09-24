# RALOA User-Flow Integrity Audit

Date: 2026-09-24  
Scope: full application journey audit across the React client, Express server, Firebase rules, billing, publishing, referrals, domains, and recovery states.  
Mode: read-only audit. No application code was changed during this audit.

## Executive summary

The repository builds and the existing server verification suites pass, but the passing tests mostly cover route contracts and isolated API behavior. The end-to-end product journeys are not yet safe to call production-ready.

The highest-impact break is the publish loop: Studio saves a site, but the public profile route resolves only against bundled template fixtures. A newly registered creator therefore cannot reliably see their saved site at their public handle. The same Studio path also forces every autosave to `isPublished: true`, which removes the draft boundary and can expose unfinished content.

Other release blockers are the fake Apple OAuth flow, client-side/offline auth fallbacks that can mask production Firebase misconfiguration, paid-plan state that is not reconciled on the checkout return, and Firestore rules that allow authenticated users to write parts of another user’s profile through the referral update branch.

### Severity totals

| Severity | Confirmed findings |
| --- | ---: |
| P0 - blocked, unsafe, or data-integrity risk | 5 |
| P1 - broken completion, misleading state, or major recovery gap | 11 |
| P2 - friction, hardening, or polish | 7 |

## Validation performed

- `npm run lint`: passed.
- `npm run build`: passed. Vite reports large minified chunks: approximately 778 kB main, 552 kB Firebase vendor, and 197 kB Studio.
- `npx tsx test-entrypoint.ts`: 16/16 passed.
- `npx tsx test-modules-2-4.ts`: passed.
- Static source tracing covered route resolution, navigation history, auth, Studio persistence, public rendering, billing, domains, referrals, rules, and modal transitions.
- Browser/device automation was not available in the repository, so actual 320/375/430/768/1280/1440 px rendering, screen-reader behavior, keyboard focus in a real browser, network interruption, and Stripe redirect behavior remain unverified.

## Actors and modes audited

| Actor or mode | Journeys included |
| --- | --- |
| Anonymous visitor | Landing page, templates, preview, handle claim, pricing, contact, newsletter, public profiles |
| New creator | Register, referral attribution, template/handle continuity, first Studio load, first save, publish |
| Returning creator | Login, logout, Studio reload, edits, undo/redo, upload/import, domain and billing settings |
| Paid or downgraded creator | Checkout, webhook, portal, plan gates, expiry/downgrade, domain access |
| Public visitor | Published handle, custom domain, link click, contact, missing/invalid handle |
| Adversarial or degraded state | Duplicate referral, self-referral, stale availability, expired auth, failed payment, SSL pending, server error, offline save |
| Device/accessibility variants | Mobile navigation, RTL, keyboard/modal focus, reduced motion; source-reviewed but not browser-verified |

## Route and state map

| Entry | Expected next state | Current implementation | Result |
| --- | --- | --- | --- |
| `/` | Home sections and CTAs | Home | Works at route level |
| `/templates` | Template gallery | `TemplatesPage` | Works at route level |
| `/features`, `/pricing`, `/guides`, `/about`, `/contact` | Corresponding page or section | `resolveInitialRoute()` maps all to `home` without section state | P1: direct deep links land at the home route rather than the requested content |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Auth modal with query state preserved | Home plus modal | Partial; staged template/plan continuity is not completed after auth |
| `/studio` | Authenticated Studio | Server guards cookie sessions; client opens Studio | Partial; Firebase and server identities can diverge |
| `/@handle`, `/public-render/handle` | Persisted public mini-site | Client/server resolve fixture metadata only | P0: creator publishing cannot complete reliably |
| `/pricing?checkout=...` | Confirmed billing result | Pricing route, no authoritative return reconciliation | P1 |

## Prioritized findings

### P0-01 - Saved creator sites are not the source for public profile rendering

- Journey: Register -> Studio -> save/publish -> open `raloa.app/@handle`.
- Evidence: `src/App.tsx:101-105` checks `templatesData` for creator existence; `src/components/PublicCreatorProfile.tsx:42-45` selects the creator from `templatesData`; `server.ts:1470-1474` uses the static `CREATORS_METADATA` map for SSR metadata.
- Impact: A real creator can save a site successfully but still receive a 404 or see a bundled demo profile. Public publishing, sharing, SEO, and custom-domain routing do not converge on the same persisted record.
- Root cause: There is no single server-side public-site lookup by normalized handle/site ID shared by SSR, client rendering, and custom-domain routing.
- Fix direction: Add an authenticated handle reservation and a public `getPublishedSite(handle)` server path. Use the same Firestore record for SSR metadata, client hydration, `@handle`, `public-render`, and custom domains. Return 404 unless `isPublished === true`.

### P0-02 - Studio autosave bypasses the draft/publish boundary

- Journey: New creator edits content -> autosave -> expects draft -> explicitly publishes later.
- Evidence: `src/components/modals/StudioModal.tsx:144` initializes `isPublished: true`; line 257 defaults missing values to true; lines 303-315 persist `isPublished: true` regardless of `configToSave.isPublished`.
- Impact: Unfinished or sensitive edits can become public immediately. The visible publish toggle cannot reliably protect content because every autosave overwrites the stored state.
- Root cause: Autosave is coupled directly to live content and hard-codes the publication state.
- Fix direction: Default new sites to unpublished, persist the actual draft separately, and make publication an explicit authenticated server mutation with audit timestamp and validation.

### P0-03 - Apple sign-in is not Apple OAuth

- Journey: Visitor selects Apple sign-in.
- Evidence: `src/components/modals/AuthModal.tsx:135-150` posts a client-provided email to `/api/v1/auth/oauth/apple`, then signs in with the hard-coded password `AppleSecureAuth2026!`.
- Impact: The button does not establish Apple identity. It can create or access predictable password-backed accounts, creates account-linking ambiguity, and is unsafe for production authentication.
- Root cause: The OAuth provider flow was replaced with a synthetic email/password shortcut.
- Fix direction: Use Firebase Apple provider or a server-side Apple authorization-code flow with nonce/state verification, then link the verified provider subject to the account. Remove the password shortcut and client-supplied identity trust.

### P0-04 - Firestore referral update rule permits cross-user profile mutation

- Journey: Authenticated user manipulates referral documents or profile updates.
- Evidence: `firestore.rules` user update rule has an `||` branch that does not require `isOwner(userId)`; it allows a qualified referral document at `users/{userId}/referrals/{request.auth.uid}` to satisfy the update condition for the target user document.
- Impact: A signed-in user can potentially increment or modify referral-related fields on another user’s profile by constructing matching client writes. This undermines rewards, counts, badges, and plan-adjacent state.
- Root cause: Ownership and reward-authority checks are split across rules and are not enforced by a server transaction.
- Fix direction: Deny all referral reward/profile mutations from the client. Move qualification and reward writes to a server transaction or callable endpoint. If a temporary rule exception remains, require both target ownership and immutable server-created claim fields.

### P0-05 - Production auth failures can silently become local mock identities

- Journey: Production sign-in or registration while Firebase providers/domains are misconfigured.
- Evidence: `src/lib/firebase.ts:39-58`, `src/lib/firebase.ts:135-174`, and `src/lib/firebase.ts:219-267` create `createLocalUser()` fallbacks; `src/contexts/AuthContext.tsx:40-76` restores `raloa_local_user` from localStorage.
- Impact: A user can appear authenticated in the UI while lacking a valid Firebase identity token. Saves, billing, domains, and server authorization then disagree, producing silent data loss, false success, or account confusion.
- Root cause: Development fallback behavior is reachable from shared auth code and is not hard-disabled in production builds.
- Fix direction: Gate local auth behind an explicit development flag, never restore it in production, and show a blocking configuration error when Firebase auth is unavailable.

## P1 findings

### P1-01 - Template and plan intent is staged but not consumed after auth

- Journey: Select template or plan -> `/register?...` -> create account -> Studio.
- Evidence: `src/App.tsx:436-451` writes session/query state; `src/components/modals/AuthModal.tsx:42-64` reads staged state; `src/App.tsx:944-947` `onSuccess` only calls `handleOpenStudio(email.split('@')[0])`.
- Impact: The user can complete registration but lose the template or plan they selected, forcing re-selection and creating conversion doubt.
- Fix direction: Use a typed post-auth intent object, validate it server-side where relevant, consume it exactly once after auth, and clear it only after Studio/checkout acknowledges it.

### P1-02 - Checkout return has no authoritative reconciliation state

- Journey: Select paid plan -> Stripe Checkout -> return to `/pricing?checkout=success`.
- Evidence: `server-services.ts:118-133` creates a success URL; `src/components/modals/PlanCheckoutModal.tsx` redirects to Stripe and local UI is the only immediate state transition; webhook handling updates Firestore asynchronously.
- Impact: Users may see a success route before payment webhook processing, remain on a stale plan, or be told activation succeeded when payment is incomplete or delayed.
- Fix direction: Add a server-authenticated checkout-session status endpoint, show a pending state, poll or refresh profile until webhook synchronization, and never unlock paid capability from the client redirect alone.

### P1-03 - Billing portal errors are invisible to the user

- Journey: Paid creator opens billing management while Stripe is unavailable or lacks a customer ID.
- Evidence: `src/App.tsx:465-480` catches the portal request and logs only to `console.error`.
- Impact: The click appears to do nothing, with no recovery instruction or support path.
- Fix direction: Add visible error, retry, and contact-support states; distinguish missing customer from provider outage.

### P1-04 - Client plan capabilities are not visibly enforced at server write boundaries

- Journey: Free creator adds links/media or uses premium controls through direct API/Firestore writes.
- Evidence: `src/lib/planCapabilities.ts` defines capability limits client-side; `firestore.rules` allows an owner to write any `users/{userId}/sites/{siteId}` data; no shared server capability validator is present in the audited paths.
- Impact: UI gates can be bypassed by direct Firestore writes or crafted requests. Pricing promises and actual entitlements can diverge.
- Fix direction: Centralize capabilities, validate every privileged mutation server-side, and make Firestore site writes server-only or rule-validated for limits and premium fields.

### P1-05 - Handle availability is not an atomic reservation

- Journey: Two visitors check the same handle, then register.
- Evidence: availability is a separate `GET /api/v1/handles/check`; registration sanitizes and stores `primary_handle` without an atomic uniqueness transaction (`server.ts:830-895`).
- Impact: Race conditions can produce duplicate handles or a mismatch between the availability result and the account actually created.
- Fix direction: Reserve handles in a unique Firestore document/transaction at registration; return a conflict and let the user choose another handle.

### P1-06 - Browser history does not fully reconstruct modal/query state

- Journey: Open template preview, use browser Back/Forward, refresh a staged checkout/template URL.
- Evidence: `src/App.tsx:306-330` calls `resolveInitialRoute()` on `popstate`, but that handler does not reconstruct `previewTemplate` or selected plan from query parameters; `handleSelectTemplate` mutates history without dispatching a state model.
- Impact: Back/Forward can leave the URL and visible modal out of sync; refresh and deep links do not behave like the in-app path.
- Fix direction: Make URL state the source of truth for preview, auth intent, checkout status, and modal visibility; parse it in one route-state reducer on initial load and every history event.

### P1-07 - Direct marketing routes are semantically different from their client destination

- Journey: Visitor or crawler opens `/features`, `/pricing`, `/guides`, `/about`, or `/contact` directly.
- Evidence: `src/App.tsx:110-112` maps those paths to `home` without a section identifier. Server SEO titles are route-specific, but the client destination is not.
- Impact: The browser title/URL can describe pricing or contact while the visible page remains at the home landing state. Deep links, back navigation, and CTA expectations are misleading.
- Fix direction: Use dedicated route components or return `{route: 'home', section: path}` and scroll/focus the target after mount, with a real route-level loading state.

### P1-08 - Studio save failures can be presented as resilient success

- Journey: Edit Studio while Firestore is unavailable or rules reject the write.
- Evidence: `src/contexts/AuthContext.tsx:136-156` always writes localStorage first and treats permission denial as a successful local fallback; `StudioModal.tsx:342-350` transitions to `saved` after the fallback path.
- Impact: A creator can close the editor believing work is synced when it exists only on one browser. The next device or public page will not contain the edits.
- Fix direction: Label local-only drafts explicitly, expose sync status and retry, prevent “live” status until server acknowledgement, and provide export/recovery before leaving.

### P1-09 - Domain verification is one-shot and lacks a reliable pending state

- Journey: Paid creator provisions a domain, adds DNS, then verifies.
- Evidence: `StudioSettingsTab.tsx:88-116` provisions and immediately verifies once; the UI stores a boolean `domainVerified` but does not poll or reload `/api/domains` for existing pending records. `server.ts:1393-1411` reports pending as a normal response.
- Impact: A correct DNS setup can appear failed simply because propagation was not complete at the first check. Users lack a clear retry/status timeline.
- Fix direction: Load persisted domain records on entry, show verification and SSL separately, poll with backoff, and expose failed/pending/active recovery instructions.

### P1-10 - Domain routing is not proven to resolve the selected published site

- Journey: Creator attaches a custom domain to a non-default site or unpublished site.
- Evidence: `/api/domains/provision` accepts `siteId`, defaults it to `default`, and persists it; the audited public rendering path still uses fixture creators rather than the persisted site. `server.ts:1469-1474` does not resolve a Firestore published site.
- Impact: A verified domain can point to the wrong content, a default site, or a fixture, creating privacy and trust failures.
- Fix direction: Validate site ownership, require published state, and route host -> domain record -> site document through one server-side renderer.

### P1-11 - Public telemetry and order/booking reads are overly broad

- Journey: Public visitor creates telemetry or an authenticated user reads data collections.
- Evidence: `firestore.rules` allows anyone to read `page_views` and `link_clicks`; `bookings` and `orders` allow any authenticated user to read all documents.
- Impact: Analytics can expose platform-wide data; authenticated users may read other customers’ bookings/orders.
- Fix direction: Make telemetry write-only to clients and aggregate server-side; scope bookings/orders to owner or server-only access with explicit tenant IDs.

## P2 findings

### P2-01 - Public and auth states use several identity/session systems

Firebase Auth, `raloa_session`, localStorage mock users, and Firestore profiles are all active. This increases stale-session and logout edge cases. Choose Firebase ID tokens plus a server verification path, or a single server session model, and document the boundary.

### P2-02 - Password reset has mixed providers and ambiguous delivery

`AuthModal` first calls the server reset endpoint and falls back to Firebase. The UI reports a successful inbox state for either path without indicating which provider owns the account. Use one production reset authority and a consistent token/redirect contract.

### P2-03 - Referral attribution is durable, but the public code is not reserved atomically

`publishReferralCode()` writes with merge semantics and referral lookup falls back to treating an unknown code as a user ID. Use a normalized unique code record and reject unknown/malformed codes instead of silently interpreting them.

### P2-04 - Client telemetry is best-effort with no consent or delivery state

`recordPageView` and `recordLinkClick` write directly from the browser and swallow all errors. Add consent handling, bounded payloads, server aggregation, and a clear non-blocking queue policy.

### P2-05 - `/api/readiness` exposes infrastructure check details

The endpoint returns Firebase, Stripe, and app URL booleans publicly. Keep detailed readiness diagnostics internal or protected and expose only a coarse health result externally.

### P2-06 - Large client chunks increase first-journey failure and slow recovery

The production build passes but reports roughly 778 kB main JavaScript and 552 kB Firebase vendor. Lazy-load Studio, Firebase/Auth, analytics, and secondary modals so the anonymous-to-signup path has a smaller failure surface.

### P2-07 - Browser-level accessibility and responsive acceptance is still unverified

The source includes modal focus helpers and RTL branches, but there is no browser automation dependency or captured matrix for keyboard focus, reduced motion, 320 px overflow, template preview, checkout, upload, and error states. Add Playwright coverage before release sign-off.

## Journey matrix

| Journey | Entry and intent | Pending state | Success state | Failure/recovery gaps | Persistence and authority | Severity |
| --- | --- | --- | --- | --- | --- | --- |
| Browse home | `/`, inspect value, select CTA | Hero/section animation | Template, pricing, or signup intent | Direct section routes do not reconstruct target | URL and client state | P1-07 |
| Claim handle | Hero handle input -> availability API -> register | Availability request | Signup opens with claimed handle banner | Check is not a reservation; malformed or stale results can race | Server registration is in-memory/cache path; no unique transaction | P1-05 |
| Explore template | `/templates` -> preview -> use template | Preview modal | `/register?template=...` | Back/refresh modal state can desync; post-auth intent can be lost | sessionStorage/query only until auth | P1-01, P1-06 |
| Register email | Signup modal -> server/Firebase | Auth loading | Studio opens | Local fallback can masquerade as production auth; handle may not be unique | mixed session/profile systems | P0-05, P1-05 |
| Sign in email | Login modal -> server/Firebase | Auth loading | Studio opens | Two authorities can disagree; stale local identity possible | cookie, Firebase, localStorage | P0-05, P2-01 |
| Google sign-in | Popup -> server session bridge | Popup/server request | Studio opens | Background server bridge failure is swallowed | Firebase identity plus cookie | P1/P2 hardening |
| Apple sign-in | Apple button | Synthetic request | Appears signed in | Not OAuth; predictable password path | client-supplied email | P0-03 |
| Password reset | Forgot -> email -> reset URL | Server/Firebase request | Password updated | Mixed token authorities and generic success | in-memory server token or Firebase | P2-02 |
| First Studio load | `/studio` after auth | Profile/site load | Editor and preview | local-only fallback can hide failed sync | Firestore plus local cache | P1-08 |
| Edit/autosave | Edit fields/links/media | 700 ms debounce | “Saved/live” status | Errors can become local-only success; publish forced true | Firestore site write | P0-02, P1-08 |
| Publish/share | Publish toggle -> public URL | Save/route transition | Public creator profile | Public route does not load saved site | static fixtures vs saved site | P0-01 |
| Public profile | `/@handle` or custom host | Route/SSR | Published creator page | New creators resolve 404/demo content; domain siteId not honored | fixture metadata | P0-01, P1-10 |
| Checkout | Pricing -> plan modal -> Stripe | Redirect/webhook | Paid plan after webhook | Return page lacks pending/reconciliation; UI copy can imply instant activation | Stripe webhook should be authority | P1-02 |
| Billing portal | Studio billing -> portal | Session request | Stripe portal | Error is console-only | Stripe customer ID | P1-03 |
| Free plan | Activate free | Server mutation | Free profile | Server/client profile can race after response | Firestore server write | P1 hardening |
| Custom domain | Provision -> DNS -> verify -> SSL | Cloudflare pending | Active domain | One-shot verification; routing not connected to persisted site | Firestore domain record | P1-09, P1-10 |
| Referral | Capture `ref` -> register -> qualify | Firestore transaction | Reward after qualified account | Rules allow cross-user referral writes; unknown code fallback | Firestore rules + client transaction | P0-04, P2-03 |
| Contact/newsletter | Public form submit | API request | Confirmation | Firestore public creates lack robust size/spam/abuse limits | Firestore/API | P2 |
| Logout | Studio -> logout | Server/Firebase signout | Home and cleared session | Multiple identities make stale state possible | cookie, Firebase, localStorage | P2-01 |
| Offline/slow | Edit or submit under network failure | Request pending | Retry or recovered save | No explicit offline queue/retry ownership | localStorage fallback | P1-08 |
| Mobile/RTL/a11y | Same journeys at mobile/RTL/keyboard | UI transitions | Usable controls | Source intent exists, browser proof missing | client only | P2-07 |

## Root-cause work order

1. Establish one authoritative identity and persistence model. Disable local auth fallbacks in production and make auth/profile/site writes return explicit server acknowledgement.
2. Build the persisted publishing path: unique handle reservation, published-site lookup, server-rendered metadata, client hydration, and custom-domain host routing.
3. Separate drafts from publication and make publish an explicit server-authorized transition.
4. Replace Apple’s synthetic flow with verified OAuth and review all social-provider identity linking.
5. Move referral rewards and paid feature gates behind server transactions/validators; tighten Firestore collection ownership and telemetry visibility.
6. Add checkout-session reconciliation and visible billing/domain pending/error states.
7. Add browser journey tests for all critical flows and the specified responsive/accessibility matrix.

## Go-live recommendation

Do not launch paid public availability yet. The route/API tests passing is useful baseline evidence, but P0 findings affect authentication safety, profile publication, draft privacy, and reward integrity. Go-live should wait until the five P0 findings are fixed, the P1 journey matrix has passing browser tests, and a real test account can register, save a private draft, publish it, view it from a clean browser, buy/ cancel a subscription, and attach/verify a domain without any client-only success state.
