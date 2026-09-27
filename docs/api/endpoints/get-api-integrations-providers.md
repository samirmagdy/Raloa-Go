---
id: get-api-integrations-providers
method: GET
path: /api/integrations/providers
status: implemented
auth: bearer
source: server.ts
verified_by: test-social-integrations.ts
updated: 2026-09-27
---
# `GET /api/integrations/providers`
Returns supported social OAuth providers and their configured status. Requires an authenticated creator.

## Summary
Authenticated creators use this endpoint to discover supported providers before connecting one.

## Request
No body. Requires a bearer/session-authenticated creator.

## Response
`200 { "providers": [{ "id": "github", "name": "GitHub", "configured": true }] }`.

## Errors
`401 AUTH_REQUIRED`; `503 INTEGRATIONS_UNAVAILABLE`.

## Evidence
```bash
curl -sS http://localhost:3987/api/integrations/providers
```
The unauthenticated request is rejected with `401 AUTH_REQUIRED`.

## Frontend wiring
Studio integration settings loads this endpoint on mount; failures remain visible as a connection error.
