---
id: delete-api-calendar-provider
method: DELETE
path: /api/calendar/*
status: implemented
auth: bearer
source: server.ts
verified_by: test-calendar.ts
updated: 2026-09-27
---
# `DELETE /api/calendar/:provider`
Disconnects a calendar provider and removes its encrypted token record.

## Summary
Disconnects Google or Outlook for the current creator.

## Request
No body. `provider` must be `google` or `outlook`.

## Response
`204 No Content`.

## Errors
`400 INVALID_CALENDAR_PROVIDER`; `401 AUTH_REQUIRED`; `404 CALENDAR_INTEGRATION_NOT_FOUND`.

## Evidence
```bash
curl -sS -X DELETE http://localhost:3987/api/calendar/google
```
Unauthenticated requests return `401 AUTH_REQUIRED`.

## Frontend wiring
Studio disconnects the provider and refreshes scheduling integration state.
