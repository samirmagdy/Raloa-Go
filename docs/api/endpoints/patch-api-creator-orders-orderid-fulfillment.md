---
id: patch-api-creator-orders-orderid-fulfillment
method: PATCH
path: /api/creator/orders/*/fulfillment
status: planned
auth: bearer or session
source: server.ts
verified_by: test-entrypoint.ts
updated: 2026-09-27
---

# `PATCH /api/creator/orders/:orderId/fulfillment`

## Request

The path contains the order ID and the body contains `fulfillmentStatus`; creator authentication and order ownership are required.

## Summary

Allows only the owning creator to transition an order to `processing`, `fulfilled`, or `cancelled` using the server-side transition graph. Paid orders can be processed and fulfilled; cancellation releases pending reservations or reconciles paid inventory exactly once.

## Response

`200 OK` returns the refreshed order, including `fulfillmentHistory`, `updatedAt`, and any inventory reconciliation timestamps.

## Errors

`400 INVALID_FULFILLMENT_STATUS`, `401 AUTH_REQUIRED`, `404 ORDER_NOT_FOUND`, `409 ORDER_NOT_PAID` or `INVALID_FULFILLMENT_TRANSITION`, or `503 ORDERS_UNAVAILABLE`.

## Evidence

```bash
curl -sS -w '\nHTTP %{http_code}\n' -X PATCH http://localhost:3987/api/creator/orders/example/fulfillment
```

Observed response without authentication: `{ "status": "error", "error": "AUTH_REQUIRED" }`, HTTP `401`.

## Frontend wiring

Creator order management can call this endpoint for fulfillment updates; retries are safe for the same status.
