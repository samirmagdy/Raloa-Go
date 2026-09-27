---
id: post-api-creator-bookings-bookingid-confirm
method: POST
path: /api/creator/bookings/*/confirm
status: implemented
auth: bearer
source: server.ts
verified_by: test-calendar.ts
updated: 2026-09-27
---
# `POST /api/creator/bookings/:bookingId/confirm`
## Summary
Confirms an owned pending booking and queues calendar/notification work.
## Request
No body; `bookingId` is a path parameter.
## Response
`200 { "id": "booking-id", "status": "confirmed", "confirmationStatus": "confirmed" }`.
## Errors
`401 AUTH_REQUIRED`; `404 BOOKING_NOT_FOUND`; `409 BOOKING_CANCELLED`.
## Evidence
```bash
curl -sS -X POST http://localhost:3987/api/creator/bookings/example/confirm
```
Unauthenticated requests return `401 AUTH_REQUIRED`.
## Frontend wiring
Creator booking management invokes this action for pending requests.
