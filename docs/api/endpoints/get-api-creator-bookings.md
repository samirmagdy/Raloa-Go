---
id: get-api-creator-bookings
method: GET
path: /api/creator/bookings
status: implemented
auth: bearer
source: server.ts
verified_by: test-calendar.ts
updated: 2026-09-27
---
# `GET /api/creator/bookings`
## Summary
Lists bookings owned by the authenticated creator.
## Request
No body; authentication is required.
## Response
`200 { "bookings": [] }`.
## Errors
`401 AUTH_REQUIRED`; `503 BOOKINGS_UNAVAILABLE`.
## Evidence
```bash
curl -sS http://localhost:3987/api/creator/bookings
```
Unauthenticated requests return `401 AUTH_REQUIRED`.
## Frontend wiring
Creator scheduling management loads this list for confirmation and cancellation controls.
