---
id: post-api-creator-products
method: POST
path: /api/creator/products
status: implemented
auth: bearer or session
source: server.ts
verified_by: test-entrypoint.ts
updated: 2026-09-27
---

# `POST /api/creator/products`

## Summary

Creates a creator-owned product and its Stripe Product and Price mapping using server-validated fields.

## Request

Body: `name`, `description`, `imageUrls`, `priceMinor`, `currency`, `active`, and nullable `inventory`. Client price data is validated but never used for checkout unless persisted by this authenticated creator write.

## Response

`201 Created` returns `{ "product": { ... } }` without Stripe secret identifiers.

## Errors

`400 INVALID_PRODUCT`, `400 INVALID_PRODUCT_IMAGES`, `401 AUTH_REQUIRED`, or `503 PRODUCTS_UNAVAILABLE` / `PRODUCT_CREATE_FAILED`.

## Evidence

```bash
curl -sS -w '\nHTTP %{http_code}\n' -X POST http://localhost:3987/api/creator/products
```

Observed response without authentication: `{ "status": "error", "error": "AUTH_REQUIRED" }`, HTTP `401`.

## Frontend wiring

`StudioProductsSettings` submits this form and reloads the server list after success.
