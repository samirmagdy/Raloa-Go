---
id: get-api-sites
method: GET
path: /api/sites
status: implemented
auth: bearer | session
source: server.ts       # handler file, relative to project root
verified_by: test-multi-site.ts
updated: 2026-09-27        # YYYY-MM-DD, the day the behaviour was last proven
---

# `GET /api/sites`

## Summary

Lists the authenticated creator's owned sites and publication state.

## Request

No path or query parameters.

The authenticated identity is resolved from the bearer/session token.

## Response

Success status: `200 OK`.

```json
{ "sites": [{ "id": "site-id", "username": "handle", "displayName": "Name", "isPublished": false, "updatedAt": null }] }
```

The response contains `sites`; `updatedAt` may be `null`.

## Errors

Every failure the frontend must handle, with the exact status and body shape:

| Status | When | Body | Client behaviour |
| --- | --- | --- | --- |
| 401 | Missing or invalid authentication | `{ "error": { "code": "AUTH_REQUIRED", "message": "Authentication required." } }` | show sign-in state |
| 503 | Persistence unavailable | structured service error | show retry state |

## Evidence

The real request that proves the behaviour above, run against the local server. Paste the command
and the observed output — never an imagined response.

```bash
curl -sS -w '\nHTTP %{http_code} in %{time_total}s\n' \
  -X GET "http://localhost:PORT/api/sites"
```

```json
{ "observed": "verbatim response body" }
```

The unauthenticated contract test returns `401`; authenticated execution requires Firebase credentials.

## Frontend wiring

- **Called by**: `StudioModal`
- **Trigger**: Studio site initialization and site switching
- **Loading state**: Studio initialization state
- **Error state**: explicit save/load error
- **Idempotency / retry**: safe to retry because it is read-only.
