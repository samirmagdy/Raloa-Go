---
id: post-api-auth-logout
method: POST
path: /api/auth/logout
status: planned
auth: session
source: apps/web/src/app/api/auth/logout/route.ts
verified_by:
updated: 2026-09-27
---

# `POST /api/auth/logout`

Clears the HttpOnly session cookie and revokes Firebase refresh tokens when a bearer token is available.

## Summary

The browser calls this before Firebase client sign-out.

## Request

No body. The request may include the current Firebase bearer token.

## Response

Returns `{ "status": "ok" }` and expires `raloa_session`.

## Errors

The operation is safe to repeat and returns `200` even when no session exists.

## Evidence

Pending staging verification with Firebase credentials.

## Frontend wiring

Call on logout; clear client Firebase state regardless of response.
