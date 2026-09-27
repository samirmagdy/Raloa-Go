---
id: post-api-integrations-provider-refresh
method: POST
path: /api/integrations/*/refresh
status: implemented
auth: bearer
source: server.ts
verified_by: test-social-integrations.ts
updated: 2026-09-27
---
# `POST /api/integrations/:provider/refresh`
Refreshes a connected provider token server-side and returns connection metadata only.

## Summary
Renews an existing provider connection without exposing the access token.

## Request
No body. `provider` is the provider path segment.

## Response
`200` with connection status metadata.

## Errors
`401 AUTH_REQUIRED`; `404 INTEGRATION_NOT_FOUND`; `503 INTEGRATIONS_UNAVAILABLE`.

## Evidence
```bash
curl -sS -X POST http://localhost:3987/api/integrations/github/refresh
```
Unauthenticated requests return `401 AUTH_REQUIRED`.

## Frontend wiring
Studio can invoke this before provider-backed operations when a connection is near expiry.
