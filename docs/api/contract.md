# Stable API contract

The API contract is defined independently of Express in `src/shared/schema`.
The current public contract version is `v1`; a future Next.js or serverless
handler must preserve these schemas and policies.

## Shared rules

- Public reads use `public`; creator writes use `authenticated` plus resource
  ownership checks; internal worker routes require provider identity or the
  background-job secret.
- Collection endpoints use opaque cursor pagination. `limit` is 1–100 and
  cursors must be returned unchanged as `nextCursor` values.
- Booking and checkout writes require `Idempotency-Key` (16–200 characters).
  Replays return the original response; concurrent requests return a conflict.
- Errors use HTTP status plus the canonical envelope `{ status: "error",
  error: { code, kind, message, requestId, fields?, details? } }`. Legacy
  top-level `code`, `message`, and `errorCode` fields remain during the
  compatibility migration, but new clients must read `error`.
- Public booking, telemetry, newsletter, and contact endpoints are rate
  limited by IP. Authenticated endpoints should use user identity plus IP when
  adding distributed limits. `Retry-After` is returned on throttling.
- Authorization is server-side and ownership-based; client-provided user or
  site IDs never establish access.

## Canonical runtime schemas

The reusable schemas live in `@raloa/schemas` (`api-contract.ts`) and are the
source of truth for error envelopes, success/accepted envelopes, cursor
pagination, idempotency keys, rate-limit metadata, and endpoint policy records.
Route-specific request and response schemas remain versioned in this package
and are referenced by endpoint documents.

Every live route must have a document in `docs/api/endpoints/` and an OpenAPI
operation. `npm run check:api` discovers Express, worker, and Next route
handlers and fails on undocumented or stale contract entries.

The machine-readable policy registry is `API_CONTRACTS`. Request/response
schemas and policy changes require a new API version or an explicitly backward
compatible addition. Express is only the current transport implementation.
