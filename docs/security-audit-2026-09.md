# Raloa security audit — 2026-09-28

## Scope and conclusion

This audit covered the Express API, Next.js application foundation, Firebase rules, PostgreSQL access layer, provider adapters, background jobs, public rendering, and the existing test/CI checks. The codebase is **secure with residual operational risk (4/5)** after the fixes in this change. No critical unauthenticated data-access or obvious SQL-injection path was found.

The audit is a source and regression review. Firebase Emulator, Stripe, Cloudflare, R2, and production-config staging checks still need to run in CI/staging before a production security sign-off.

## Findings and remediation

| Area | Finding | Severity | Status |
|---|---|---:|---|
| CSRF | Cookie-authenticated unsafe mutations did not require an application-origin `Origin`/`Referer`. | High | Fixed with `server/core/csrf.ts` and production Express middleware. Bearer-token API calls are not subject to this browser-cookie check. |
| Firebase token verification | Express and Next.js bearer verification did not request revoked-token checking. | High | Fixed with `verifyIdToken(token, true)` and token-shape validation. |
| XSS | Public JSON-LD was inserted using raw `JSON.stringify`, allowing HTML termination characters in user-controlled values. | High | Fixed with `safeJsonLd` in `CreatorPage.tsx`. |
| Webhook data minimization | Stripe billing ledger stored the normalized event's provider payload. | Medium | Fixed: ledger stores only normalized identifiers/status/amount fields; payment processing remains provider-neutral. |
| Cloudflare path handling | Provider hostname IDs were interpolated into API paths without encoding. | Low | Fixed with `encodeURIComponent`. |
| Security headers | Next.js deployment did not carry the legacy server's baseline headers. | Medium | Fixed in `apps/web/next.config.mjs`, including HSTS, CSP, frame, MIME, referrer, permissions, COOP, and cross-domain policy headers. |

## Control review

- **Authentication:** Firebase Admin verifies ID tokens server-side; session cookies are HTTP-only, SameSite=Lax, and secure in production. Internal user/account resolution is separate from token verification. Revoked-token checks are enabled on both server paths.
- **Authorization and IDOR:** Resource policies are centralized and default-deny. Repository/service paths carry tenant/site ownership. Existing negative authorization and tenant-boundary tests cover sites, audience, bookings, commerce, domains, media, integrations, billing, and analytics.
- **Tenant isolation:** Firestore ownership rules and server-side policy checks scope access by authenticated owner/account/site. Cross-tenant access is rejected by policy tests; browser-supplied user IDs are not authoritative.
- **SQL injection:** PostgreSQL calls use parameter bindings. Dynamic table/column choices are selected from fixed internal enums, not request strings. Route persistence-boundary checks remain enabled.
- **XSS:** Public JSON-LD is escaped for HTML script context. Public URLs are scheme-allowlisted. React output remains escaped by default. CSP is present on both delivery paths.
- **CSRF:** Cookie session mutations require same-origin evidence in production. API routes using bearer tokens do not rely on ambient browser credentials.
- **SSRF:** Provider calls use fixed provider origins and typed adapters. User-controlled domain values are validated as hostnames and are not used as arbitrary fetch URLs.
- **Webhooks:** Stripe signatures are verified before normalization; webhook event IDs are unique and processed idempotently. The ledger no longer retains provider payloads unnecessarily.
- **OAuth:** State is HMAC-signed, nonce-backed, expiring, and single-use. Callback parsing now rejects malformed multi-part state values. Refresh tokens are encrypted by the integration service. PKCE/browser binding remains a recommended future hardening item for browser-started flows.
- **Uploads:** MIME, size, ownership, quota, and image-dimension checks exist; processed/public media is exposed only after `ready` state. R2 credentials are server-only. A staging test should additionally exercise malformed magic bytes and oversized decompression cases.
- **Rate limiting:** Policies are differentiated by auth, public forms, analytics, media, domains, checkout, and OAuth; keys combine the appropriate tenant/user/IP dimensions.
- **Secrets:** Secret scanning and production environment validation are wired into CI. OAuth, Stripe, KMS, and Cloudflare values are not sent to client bundles or error payloads. Envelope encryption has versioned key metadata and rotation support.
- **Headers/CORS:** No permissive CORS middleware was found; browser cross-origin reads are not enabled by default. Security headers are now present in Express and Next.js paths.
- **Open redirects:** Redirect destinations are fixed application/provider URLs or validated local paths; no request parameter is used as an arbitrary redirect target.
- **Domain takeover:** Hostname normalization rejects platform-owned domains, domain records are tenant-owned, verification/provisioning is asynchronous and idempotent, and public routing requires verified domain plus active certificate state. Provider IDs are path encoded.

## Regression checks

Passed during this audit:

```text
npm run lint
npm run test:security-audit
npm run test:contracts
```

The existing suites remain available through `npm run test:all`, `npm run test:e2e`, `npm run check:secrets`, `npm run check:route-persistence`, and `npm run check:provider-boundary`. Provider staging and Firebase Emulator rules tests are environmental gates, not substitutes for the unit regressions above.

## Residual risks / follow-up gates

1. Run Firebase Firestore/Storage rules tests in the Emulator with authenticated, unauthenticated, and cross-tenant matrices.
2. Run real staging contract tests for Stripe, Cloudflare, R2, Google/Microsoft OAuth, and email with synthetic data.
3. Add PKCE and a browser/session binding for OAuth flows initiated from a browser.
4. Add upload magic-byte and decompression-bomb tests before enabling unrestricted direct uploads.
5. Keep `apps/web` and Express security-header snapshots in deployment smoke tests so a future proxy/CDN cannot remove them.
