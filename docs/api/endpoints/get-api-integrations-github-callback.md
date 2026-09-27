---
id: get-api-integrations-github-callback
method: GET
path: /api/integrations/github/callback
status: implemented
auth: <none>
source: server.ts
verified_by: test-social-integrations.ts
updated: 2026-09-27
---
# `GET /api/integrations/github/callback`
Consumes the one-time signed GitHub OAuth callback, encrypts the provider token server-side, and redirects to Studio.

## Summary
Completes GitHub OAuth and stores only encrypted provider credentials server-side.

## Request
Query parameters `code` and signed `state` are required.

## Response
`302` to Studio after successful connection.

## Errors
`400 OAUTH_CALLBACK_INVALID`; `503 INTEGRATION_NOT_CONFIGURED`.

## Evidence
```bash
curl -sS -I 'http://localhost:3987/api/integrations/github/callback'
```
Missing callback parameters return `400 OAUTH_CALLBACK_INVALID`.

## Frontend wiring
The OAuth provider redirects here; the route redirects back to Studio.
