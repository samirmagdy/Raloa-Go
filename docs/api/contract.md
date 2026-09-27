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
- Errors use HTTP status plus `{ status: "error", error, code, message,
  fields? }`. The legacy string fields remain during compatibility migration.
- Public booking, telemetry, newsletter, and contact endpoints are rate
  limited by IP. Authenticated endpoints should use user identity plus IP when
  adding distributed limits. `Retry-After` is returned on throttling.
- Authorization is server-side and ownership-based; client-provided user or
  site IDs never establish access.

The machine-readable policy registry is `API_CONTRACTS`. Request/response
schemas and policy changes require a new API version or an explicitly backward
compatible addition. Express is only the current transport implementation.
