---
id: delete-api-creator-products-productid
method: DELETE
path: /api/creator/products/*
status: implemented
auth: bearer or session
source: server.ts
verified_by: test-entrypoint.ts
updated: 2026-09-27
---

# `DELETE /api/creator/products/:productId`

## Request

The path contains the product ID. Requires creator authentication and ownership; deletion is implemented as archive.

## Summary

Archives an owned product and deactivates its Stripe Product and Price without deleting historical orders.

## Response

`200 OK` returns `{ "id": "...", "active": false }`.

## Errors

`401 AUTH_REQUIRED`, `404 PRODUCT_NOT_FOUND`, or `503 PRODUCT_ARCHIVE_FAILED`.

## Evidence

```bash
curl -sS -w '\nHTTP %{http_code}\n' -X DELETE http://localhost:3987/api/creator/products/example
```

Observed response without authentication: `{ "status": "error", "error": "AUTH_REQUIRED" }`, HTTP `401`.

## Frontend wiring

`StudioProductsSettings` exposes archive as a destructive-safe deactivation action.
