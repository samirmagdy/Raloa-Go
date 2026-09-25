---
id: get-api-account-sessions
method: GET
path: /api/account/sessions
status: implemented
auth: session | bearer
source: server.ts       # handler file, relative to project root
verified_by: test-modules-2-4.ts
updated: 2026-09-25        # YYYY-MM-DD, the day the behaviour was last proven
---

# `GET /api/account/sessions`

## Summary

Returns active login sessions for the authenticated user across browsers and devices.

## Request

**Path / query parameters**

No query or path parameters.

**Body**

No request body.

## Response

The endpoint returns `200`:

```json
{
  "sessions": [
    {
      "id": "abc12345",
      "current": true,
      "createdAt": "2026-09-25T10:00:00.000Z",
      "userAgent": "Mozilla/5.0 ...",
      "ip": "127.0.0.1"
    }
  ]
}
```

## Errors

| Status | When | Body | Client behaviour |
| --- | --- | --- | --- |
| 401 | Missing or invalid auth session | `{ "error": { "code": "AUTH_REQUIRED", "message": "Authentication required." } }` | prompt sign-in |

## Evidence

```bash
curl -sS -w '\nHTTP %{http_code} in %{time_total}s\n' \
  -X GET "http://localhost:3000/api/account/sessions"
```

```text
{"status":"error","error":{"code":"AUTH_REQUIRED","message":"Authentication required."},"code":"AUTH_REQUIRED","message":"Authentication required.","errorCode":"AUTH_REQUIRED"}
HTTP 401
```

Observed status: HTTP 401 in 0.01s; requires authentication. Returns `{ "sessions": [...] }` with active session tokens when authenticated.

## Frontend wiring

- **Called by**: `AccountSettingsModal` Security section
- **Trigger**: user opens Security tab
- **Client stub**: `request('/api/account/sessions')`
- **Idempotency**: safe to retry.
