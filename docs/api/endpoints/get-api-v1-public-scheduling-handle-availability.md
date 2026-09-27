---
id: get-api-v1-public-scheduling-handle-availability
method: GET
path: /api/v1/public/scheduling/*/availability
status: implemented
auth: <none>
source: server.ts
verified_by: test-entrypoint.ts
updated: 2026-09-27
---

# `GET /api/v1/public/scheduling/:handle/availability`

## Summary

Visitors call this endpoint to receive server-calculated slots for one configured service; existing bookings, blackout dates, notice, daily limits, and timezone are applied server-side.

## Request

Required query parameters are `from`, `to` (`YYYY-MM-DD`, maximum 31 days), and `serviceId` (`^[a-z0-9_-]{1,64}$`). No authentication is required.

## Response

On `200 OK`:

```json
{ "timezone": "America/New_York", "service": { "id": "consultation", "name": "Consultation", "durationMinutes": 60 }, "slots": [{ "start": "2026-09-28T13:00:00.000Z", "end": "2026-09-28T14:00:00.000Z", "localDate": "2026-09-28", "localTime": "09:00", "serviceId": "consultation" }] }
```

## Errors

`400 INVALID_AVAILABILITY_REQUEST` or `INVALID_DATE_RANGE`, `404 SERVICE_NOT_FOUND`, or `503 SCHEDULING_UNAVAILABLE`, using the standard error envelope.

## Evidence

With local infrastructure intentionally unconfigured, the route correctly fails closed:

```bash
curl -sS -w '\\nHTTP %{http_code} in %{time_total}s\\n' 'http://localhost:3987/api/v1/public/scheduling/elena/availability?from=2026-09-28&to=2026-09-28&serviceId=consultation'
```

```json
{ "status": "error", "error": { "code": "SCHEDULING_UNAVAILABLE", "message": "Scheduling is not configured." } }
```

Observed status: `HTTP 503`.

## Frontend wiring

`BookingSchedulerModal` calls this whenever the selected date or service changes. It is safe to retry; the booking POST performs a second authoritative check to prevent stale-slot confirmation.
