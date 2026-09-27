---
id: post-api-creator-bookings-bookingid-cancel
method: POST
path: /api/creator/bookings/*/cancel
status: implemented
auth: bearer
source: server.ts
verified_by: test-calendar.ts
updated: 2026-09-27
---
# `POST /api/creator/bookings/:bookingId/cancel`
## Summary
Cancels an owned booking, releases its slot lock, and queues customer notification/calendar cancellation.
## Request
No body; `bookingId` is a path parameter.
## Response
`200 { "id": "booking-id", "status": "cancelled", "confirmationStatus": "cancelled" }`.
## Errors
`401 AUTH_REQUIRED`; `404 BOOKING_NOT_FOUND`.
## Evidence
```bash
curl -sS -X POST http://localhost:3987/api/creator/bookings/example/cancel
```
Unauthenticated requests return `401 AUTH_REQUIRED`.
## Frontend wiring
Creator booking management invokes this action for pending or confirmed bookings.
