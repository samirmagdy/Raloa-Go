---
id: delete-api-integrations-provider
method: DELETE
path: /api/integrations/*
status: implemented
auth: bearer
source: server.ts
verified_by: test-social-integrations.ts
updated: 2026-09-27
---
# `DELETE /api/integrations/:provider`
Disconnects a social provider and permanently removes its encrypted server-side token.

## Summary
Removes the current creator's connection to a social provider.

## Request
No body. `provider` is the provider path segment.

## Response
`204 No Content`.

## Errors
`401 AUTH_REQUIRED`; `404 INTEGRATION_NOT_FOUND`.

## Evidence
```bash
curl -sS -X DELETE http://localhost:3987/api/integrations/github
```
Unauthenticated requests return `401 AUTH_REQUIRED`.

## Frontend wiring
The Studio disconnect action calls this and refreshes the integration list.
