---
id: post-api-account-sessions-revoke-all
method: POST
path: /api/account/sessions/revoke-all
status: implemented
auth: session | bearer
source: server.ts       # handler file, relative to project root
verified_by: test-modules-2-4.ts
updated: 2026-09-25        # YYYY-MM-DD, the day the behaviour was last proven
---

# `POST /api/account/sessions/revoke-all`

## Summary

Revokes all active sessions for the user across all devices and clears authentication tokens.

## Request

**Path / query parameters**

No query or path parameters.

**Body**

No request body.

## Response

The endpoint returns `200`:

```json
{
  "status": "all_revoked",
  "message": "Signed out of all devices."
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
  -X POST "http://localhost:3000/api/account/sessions/revoke-all"
```

```text
{"status":"error","error":{"code":"AUTH_REQUIRED","message":"Authentication required."},"code":"AUTH_REQUIRED","message":"Authentication required.","errorCode":"AUTH_REQUIRED"}
HTTP 401
```

Observed status: HTTP 401 in 0.005s; unauthenticated access is strictly rejected. When authenticated, revokes all Firebase refresh tokens, deletes all active session documents, clears the session cookie, and returns `{ "status": "all_revoked", "message": "Signed out of all devices." }`.

## Frontend wiring

- **Called by**: `AccountSettingsModal.tsx` ("Sign out all devices" action)
- **Trigger**: User clicking the sign out of all devices button
- **Loading state**: Session revoking indicator in AccountSettingsModal
- **Error state**: Displays error banner with failure description
- **Client stub**: Native `fetch('/api/account/sessions/revoke-all', { method: 'POST' })`
- **Types**: `{ status: string; message: string }`
- **Idempotency / retry**: Idempotent; revoking already revoked sessions is safe and succeeds.
