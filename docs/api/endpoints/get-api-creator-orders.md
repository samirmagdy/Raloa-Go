---
id: get-api-creator-orders
method: GET
path: /api/creator/orders
status: planned
auth: bearer or session
source: server.ts
verified_by: test-entrypoint.ts
updated: 2026-09-27
---

# `GET /api/creator/orders`

## Request

Creator authentication is required. The optional `siteId` query parameter must
belong to the authenticated creator.

## Summary

Returns orders owned by the authenticated creator, including fulfillment status,
timestamps, and fulfillment history. Older orders without a persisted `siteId`
are resolved through their owned product for compatibility.

## Response

`200 OK` returns `{ "orders": [...] }`. Each fulfillment update is performed
through `PATCH /api/creator/orders/:orderId/fulfillment`.

## Errors

`401 AUTH_REQUIRED`, `404 SITE_NOT_FOUND`, or `503 ORDERS_UNAVAILABLE`.

## Evidence

```bash
curl -sS -w '\nHTTP %{http_code}\n' 'http://localhost:3987/api/creator/orders?siteId=site-1'
```

Unauthenticated requests must return `401 AUTH_REQUIRED`.

## Frontend wiring

`StudioProductsSettings` calls this endpoint with the selected `siteId` and
refreshes it after every fulfillment mutation.
