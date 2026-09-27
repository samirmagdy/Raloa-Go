---
id: patch-api-creator-products-productid
method: PATCH
path: /api/creator/products/*
status: implemented
auth: bearer or session
source: server.ts
verified_by: test-entrypoint.ts
updated: 2026-09-27
---

# `PATCH /api/creator/products/:productId`

## Request

The path contains the product ID and the JSON body may contain product fields. The request requires creator authentication and ownership.

## Summary

Updates an owned product and creates a new Stripe Price when price or currency changes.

## Response

`200 OK` returns the sanitized product. Existing reserved inventory cannot be reduced below the reserved amount.

## Errors

`400 INVALID_PRODUCT`, `401 AUTH_REQUIRED`, `404 PRODUCT_NOT_FOUND`, or `503 PRODUCT_UPDATE_FAILED`.

## Evidence

```bash
curl -sS -w '\nHTTP %{http_code}\n' -X PATCH http://localhost:3987/api/creator/products/example
```

Observed response without authentication: `{ "status": "error", "error": "AUTH_REQUIRED" }`, HTTP `401`.

## Frontend wiring

The Studio editor uses this endpoint for edits; Stripe IDs and authoritative prices remain server-only.
