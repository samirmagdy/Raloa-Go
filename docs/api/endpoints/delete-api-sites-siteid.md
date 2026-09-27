---
id: delete-api-sites-siteid
method: DELETE
path: /api/sites/*
status: implemented
auth: bearer | session
source: server.ts       # handler file, relative to project root
verified_by: test-multi-site.ts
updated: 2026-09-27        # YYYY-MM-DD, the day the behaviour was last proven
---

# `DELETE /api/sites/*`

## Summary

Deletes an authenticated creator's owned draft site.

## Request

`siteId` is a path parameter and must belong to the authenticated creator.

No request body.

## Response

Returns `204 No Content` on success.

List every field the client may read, and distinguish `null` from absent.

## Errors

Every failure the frontend must handle, with the exact status and body shape:

| Status | When | Body | Client behaviour |
| --- | --- | --- | --- |
| 401 | Missing or invalid authentication | `AUTH_REQUIRED` | show sign-in state |
| 404 | Site is missing or not owned | `SITE_NOT_FOUND` | refresh site list |
| 409 | Site is still published | `SITE_PUBLISHED` | unpublish first |
| 503 | Persistence unavailable | structured service error | show retry state |

## Evidence

The real request that proves the behaviour above, run against the local server. Paste the command
and the observed output — never an imagined response.

```bash
curl -sS -w '\nHTTP %{http_code} in %{time_total}s\n' \
  -X DELETE "http://localhost:PORT/api/sites/*"
```

```json
{ "observed": "verbatim response body" }
```

The unauthenticated contract test returns `401`; authenticated execution requires Firebase credentials.

## Frontend wiring

- **Called by**: `StudioModal`
- **Trigger**: explicit delete confirmation
- **Loading state**: delete action state
- **Error state**: ownership, published-state, and service errors
- **Idempotency / retry**: safe to retry after a confirmed failure.
