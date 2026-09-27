---
id: get-api-auth-session
method: GET
path: /api/auth/session
status: planned
auth: session
source: apps/web/src/app/api/auth/session/route.ts
verified_by:
updated: 2026-09-27
---

# `GET /api/auth/session`

Returns the current Firebase-authenticated internal PostgreSQL user.

## Summary

Server components and clients use this endpoint to check the current authenticated session.

## Request

Send the HttpOnly `raloa_session` cookie or a Firebase bearer token.

## Response

Returns `{ "status": "ok", "user": ... }` or a consistent `401` error envelope.

## Errors

`401` missing, expired, revoked, or invalid session; `500` auth/database service unavailable.

## Evidence

Pending staging verification with Firebase credentials.

## Frontend wiring

Use for session hydration; authorization remains server-side.
