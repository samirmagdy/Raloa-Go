---
id: get-api-account-orders
method: GET
path: /api/account/orders
status: planned
auth: bearer or session
source: server.ts
verified_by: test-entrypoint.ts
updated: 2026-09-27
---

# `GET /api/account/orders`

## Summary

Returns the authenticated customer’s orders and orders owned by the authenticated creator.

## Request

No body or query parameters. Requires the authenticated user’s bearer token or session cookie.

## Response

`200 OK` returns `{ "orders": [...] }`. Prices, payment status, and fulfillment status come from server records.

## Errors

`401 AUTH_REQUIRED` or `503 ORDERS_UNAVAILABLE`.

## Evidence

```bash
curl -sS -w '\nHTTP %{http_code}\n' http://localhost:3987/api/account/orders
```

Observed response without authentication: `{ "status": "error", "error": "AUTH_REQUIRED" }`, HTTP `401`.

## Frontend wiring

Account order history calls this endpoint with the Firebase bearer token. It is read-only and safe to retry.
