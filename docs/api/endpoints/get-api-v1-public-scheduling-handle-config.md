---
id: get-api-v1-public-scheduling-handle-config
method: GET
path: /api/v1/public/scheduling/*/config
status: implemented
auth: <none>
source: server.ts
verified_by: test-entrypoint.ts
updated: 2026-09-27
---

# `GET /api/v1/public/scheduling/:handle/config`

## Summary

Visitors call this endpoint to load the public scheduling configuration for a published creator page.

## Request

The `handle` path parameter must match `^[a-z0-9_-]{3,30}$`. There is no request body and no authentication requirement.

## Response

On `200 OK`, the response contains the creator handle, IANA timezone, booking window, and configured services:

```json
{ "handle": "creator", "timezone": "America/New_York", "today": "2026-09-27", "bookingWindowDays": 30, "services": [{ "id": "consultation", "name": "Consultation", "durationMinutes": 60 }] }
```

## Errors

`400 INVALID_HANDLE`, `404 SCHEDULING_DISABLED`, or `503 SCHEDULING_UNAVAILABLE`, using the standard error envelope.

## Evidence

With local infrastructure intentionally unconfigured, the route correctly fails closed:

```bash
curl -sS -w '\\nHTTP %{http_code} in %{time_total}s\\n' 'http://localhost:3987/api/v1/public/scheduling/elena/config'
```

```json
{ "status": "error", "error": { "code": "SCHEDULING_UNAVAILABLE", "message": "Scheduling is not configured." } }
```

Observed status: `HTTP 503`.

## Frontend wiring

`BookingSchedulerModal` calls this on mount. It is safe to retry and has no side effects; a disabled or unconfigured schedule is shown as an actionable error.
