---
id: get-api-v1-public-products-handle
method: GET
path: /api/v1/public/products/*
status: implemented
auth: <none>
source: server.ts
verified_by: test-entrypoint.ts
updated: 2026-09-27
---

# `GET /api/v1/public/products/:handle`

## Request

The `handle` path parameter identifies a published creator. No authentication or request body is required.

## Summary

Returns only active products belonging to a published creator page.

## Response

`200 OK` returns `{ "products": [...] }` with public fields, available quantity, and persisted price; Stripe IDs are omitted.

## Errors

`400 INVALID_HANDLE`, `404 CREATOR_NOT_FOUND`, or `503 PRODUCTS_UNAVAILABLE`.

## Evidence

```bash
curl -sS -w '\nHTTP %{http_code}\n' http://localhost:3987/api/v1/public/products/elena
```

Observed response without product infrastructure: `{ "status": "error", "error": "PRODUCTS_UNAVAILABLE" }`, HTTP `503`.

## Frontend wiring

`ProductStoreModal` loads this endpoint when a public shop block is opened.
