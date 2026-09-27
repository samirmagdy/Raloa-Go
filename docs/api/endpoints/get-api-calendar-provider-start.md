---
id: get-api-calendar-provider-start
method: GET
path: /api/calendar/*/start
status: implemented
auth: bearer
source: server.ts
verified_by: test-calendar.ts
updated: 2026-09-27
---
# `GET /api/calendar/:provider/start`
Starts signed Google or Outlook OAuth for a Studio creator.

## Summary
Begins provider authorization using a one-time signed state.

## Request
No body. `provider` must be `google` or `outlook`.

## Response
`302` to the provider authorization endpoint, or `200` URL JSON when `format=json` is supplied.

## Errors
`400 INVALID_CALENDAR_PROVIDER`; `401 AUTH_REQUIRED`; `403 ENTITLEMENT_REQUIRED`; `503 CALENDAR_NOT_CONFIGURED`.

## Evidence
```bash
curl -sS http://localhost:3987/api/calendar/google/start?format=json
```
Unauthenticated requests return `401 AUTH_REQUIRED`.

## Frontend wiring
The connect-calendar control opens the returned authorization URL.
