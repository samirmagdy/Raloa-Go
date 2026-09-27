---
id: get-api-integrations-github-start
method: GET
path: /api/integrations/github/start
status: implemented
auth: bearer
source: server.ts
verified_by: test-social-integrations.ts
updated: 2026-09-27
---
# `GET /api/integrations/github/start`
Creates a short-lived signed OAuth state and redirects (or returns JSON with `?format=json`) to GitHub authorization.

## Summary
Starts the GitHub OAuth authorization flow for an authenticated creator.

## Request
No body. Optional `format=json` returns the authorization URL instead of redirecting.

## Response
`302` to GitHub, or `200 { "url": "https://github.com/..." }` with JSON format.

## Errors
`401 AUTH_REQUIRED`; `403 ENTITLEMENT_REQUIRED`; `503 INTEGRATION_NOT_CONFIGURED`.

## Evidence
```bash
curl -sS http://localhost:3987/api/integrations/github/start?format=json
```
Unauthenticated requests return `401 AUTH_REQUIRED`.

## Frontend wiring
The Studio connect action opens the returned authorization URL.
