---
id: get-api-integrations
method: GET
path: /api/integrations
status: implemented
auth: bearer
source: server.ts
verified_by: test-social-integrations.ts
updated: 2026-09-27
---
# `GET /api/integrations`
Lists the authenticated creator's connected social integrations without exposing tokens.

## Summary
Returns provider connection metadata for the current creator.

## Request
No body. Requires authentication.

## Response
`200 { "integrations": [{ "provider": "github", "status": "connected", "scopes": [] }] }`.

## Errors
`401 AUTH_REQUIRED`; `503 INTEGRATIONS_UNAVAILABLE`.

## Evidence
```bash
curl -sS http://localhost:3987/api/integrations
```
Unauthenticated requests return `401 AUTH_REQUIRED`.

## Frontend wiring
Studio integration settings uses the list to render connected/disconnected state.
