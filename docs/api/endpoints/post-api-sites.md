---
id: post-api-sites
method: POST
path: /api/sites
status: implemented
auth: bearer | session
source: server.ts       # handler file, relative to project root
verified_by: test-multi-site.ts
updated: 2026-09-27        # YYYY-MM-DD, the day the behaviour was last proven
---

# `POST /api/sites`

## Summary

Creates a new draft site owned by the authenticated creator.

## Request

No path or query parameters.

The request contains site content validated by the shared content schema and server-side entitlements.

## Response

Success status: `201 Created`.

```json
{ "site": { "id": "site-id", "isPublished": false } }
```

The response contains the persisted site object.

## Errors

Every failure the frontend must handle, with the exact status and body shape:

| Status | When | Body | Client behaviour |
| --- | --- | --- | --- |
| 400 | Invalid site content | structured validation error | show validation error |
| 401 | Missing or invalid authentication | `AUTH_REQUIRED` | show sign-in state |
| 403 | Plan entitlement violation | `ENTITLEMENT_REQUIRED` | show upgrade/error state |
| 409 | Handle conflict | `HANDLE_IN_USE` | request another handle |
| 503 | Persistence unavailable | structured service error | show retry state |

## Evidence

The real request that proves the behaviour above, run against the local server. Paste the command
and the observed output — never an imagined response.

```bash
curl -sS -w '\nHTTP %{http_code} in %{time_total}s\n' \
  -X POST "http://localhost:PORT/api/sites"
```

```json
{ "observed": "verbatim response body" }
```

The unauthenticated contract test returns `401`; authenticated execution requires Firebase credentials.

## Frontend wiring

- **Called by**: `StudioModal` site creation
- **Trigger**: explicit new-site action
- **Loading state**: creation action state
- **Error state**: entitlement, validation, conflict, and service errors
- **Idempotency / retry**: retry only after a failed response; the client does not blindly repeat an unknown result.
