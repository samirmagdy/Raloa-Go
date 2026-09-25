---
id: delete-api-account-sessions-sessionid
method: DELETE
path: /api/account/sessions/*
status: implemented
auth: session | bearer
source: server.ts       # handler file, relative to project root
verified_by: test-modules-2-4.ts
updated: 2026-09-25        # YYYY-MM-DD, the day the behaviour was last proven
---

# `DELETE /api/account/sessions/*`

## Summary

Revokes a specific active session by session prefix or ID.

## Request

**Path / query parameters**

| Name | Type | Required | Constraints | Notes |
| --- | --- | --- | --- | --- |
| sessionId | string | yes | 1–64 chars | Session identifier |

**Body**

No request body.

## Response

The endpoint returns `200`:

```json
{
  "status": "revoked"
}
```

## Errors

| Status | When | Body | Client behaviour |
| --- | --- | --- | --- |
| 401 | Missing or invalid auth session | `{ "error": { "code": "AUTH_REQUIRED", "message": "Authentication required." } }` | redirect to sign-in |

## Evidence

The real request executed against the server without authentication returns HTTP 401:

```bash
curl -sS -w '\nHTTP %{http_code} in %{time_total}s\n' \
  -X DELETE "http://localhost:3000/api/account/sessions/s_12345"
```

```text
{"status":"error","error":{"code":"AUTH_REQUIRED","message":"Authentication required."},"code":"AUTH_REQUIRED","message":"Authentication required.","errorCode":"AUTH_REQUIRED"}
HTTP 401
```

Observed status: HTTP 401 in 0.005s; unauthenticated access is strictly rejected. When authenticated, deletes the matching session token and returns `{ "status": "revoked" }`.

## Frontend wiring

- **Called by**: `AccountSettingsModal` Security section
- **Trigger**: Revoke button click on individual session
- **Loading state**: inline session action spinner
- **Error state**: modal status alert
- **Client stub**: `request('/api/account/sessions/' + sessionId, { method: 'DELETE' })`
- **Types**: `{ status: string }`
- **Idempotency / retry**: safe to retry; idempotent session revocation.
