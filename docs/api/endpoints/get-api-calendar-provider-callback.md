---
id: get-api-calendar-provider-callback
method: GET
path: /api/calendar/*/callback
status: implemented
auth: <none>
source: server.ts
verified_by: test-calendar.ts
updated: 2026-09-27
---
# `GET /api/calendar/:provider/callback`
Consumes the one-time callback, encrypts tokens server-side, and redirects to Studio.

## Summary
Completes Google or Outlook OAuth and stores encrypted refresh/access credentials server-side.

## Request
Query parameters `code` and signed `state` are required.

## Response
`302` to Studio after a successful connection.

## Errors
`400 OAUTH_CALLBACK_INVALID`; `503 CALENDAR_NOT_CONFIGURED`.

## Evidence
```bash
curl -sS -I http://localhost:3987/api/calendar/google/callback
```
Missing callback parameters return `400 OAUTH_CALLBACK_INVALID`.

## Frontend wiring
The provider redirects here; this route redirects back to Studio.
