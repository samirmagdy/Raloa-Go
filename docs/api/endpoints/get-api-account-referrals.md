---
id: get-api-account-referrals
method: GET
path: /api/account/referrals
status: planned          # implemented | planned | deprecated
auth: <none | bearer | session | api-key>   # and what happens when it is missing
source: server.ts       # handler file, relative to project root
verified_by:             # test file that executes this route; required before status: implemented
updated: 2026-09-25        # YYYY-MM-DD, the day the behaviour was last proven
---

# `GET /api/account/referrals`

## Summary

FILL: one sentence — who calls this, and what becomes true afterwards.

## Request

**Path / query parameters**

| Name | Type | Required | Constraints | Notes |
| --- | --- | --- | --- | --- |
| FILL | string | yes | 1–64 chars | FILL |

**Body**

```json
{ "FILL": "field names, exact types, nullability" }
```

**Validation** — FILL: which invalid values are rejected on write, and which are stored as-is.
State whether completeness is enforced here or only at the publish/commit boundary.

## Response

FILL the real code (`200` / `201` + `Location` / `204`) — pick what the server actually sends:

```json
{ "FILL": "the literal body, including envelope keys" }
```

List every field the client may read, and distinguish `null` from absent.

## Errors

Every failure the frontend must handle, with the exact status and body shape:

| Status | When | Body | Client behaviour |
| --- | --- | --- | --- |
| 400 | FILL validation failure | `{ "error": { "code": "FILL", "message": "FILL" } }` | show field error |
| 401 | FILL | FILL | redirect to sign-in |
| 409 | FILL | FILL | refetch, do not retry blindly |

## Evidence

The real request that proves the behaviour above, run against the local server. Paste the command
and the observed output — never an imagined response.

```bash
curl -sS -w '\nHTTP %{http_code} in %{time_total}s\n' \
  -X GET "http://localhost:PORT/api/account/referrals"
```

```json
{ "observed": "verbatim response body" }
```

FILL: status line, timing, row counts, and anything surprising seen while running it.

## Frontend wiring

- **Called by**: FILL screen/action
- **Trigger**: FILL (mount / submit / poll)
- **Loading state**: FILL
- **Error state**: which `## Errors` rows map to which UI state
- **Client stub**: FILL (generated function name, e.g. `api.users.update`)
- **Types**: FILL (request/response type names and where they live)
- **Idempotency / retry**: FILL — safe to retry? what does a double submit do?
