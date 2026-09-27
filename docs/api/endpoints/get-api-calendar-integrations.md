---
id: get-api-calendar-integrations
method: GET
path: /api/calendar/integrations
status: implemented
auth: bearer
source: server.ts
verified_by: test-calendar.ts
updated: 2026-09-27
---
# `GET /api/calendar/integrations`
Lists Google and Outlook calendar connection status without returning OAuth tokens.

## Summary
Creators use this endpoint to inspect calendar connection state before enabling booking sync.

## Request
No body. Requires authentication.

## Response
`200 { "integrations": [{ "provider": "google", "status": "connected" }] }`.

## Errors
`401 AUTH_REQUIRED`; `503 CALENDAR_UNAVAILABLE`.

## Evidence
```bash
curl -sS http://localhost:3987/api/calendar/integrations
```
Unauthenticated requests return `401 AUTH_REQUIRED`.

## Frontend wiring
Studio scheduling uses this to show connect/disconnect state.
