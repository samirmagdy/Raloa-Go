---
id: post-api-auth-session
method: POST
path: /api/auth/session
status: planned
auth: bearer
source: apps/web/src/app/api/auth/session/route.ts
verified_by:
updated: 2026-09-27
---

# `POST /api/auth/session`

Exchanges a verified Firebase ID token for a short-lived, HttpOnly Firebase session cookie.

## Summary

The browser calls this after Firebase sign-in before using authenticated Next.js server routes.

## Request

Send `Authorization: Bearer <Firebase ID token>`.

## Response

Returns `{ "status": "ok", "user": ... }` and sets `raloa_session` with a five-day expiry.

## Errors

`401` missing or invalid Firebase token; `500` auth/database service unavailable.

## Evidence

Pending staging verification with Firebase credentials.

## Frontend wiring

Call after Firebase sign-in; never send a browser-supplied user ID.
