---
id: post-api-v1-public-products-handle-checkout
method: POST
path: /api/v1/public/products/*/checkout
status: implemented
auth: <none>
source: server.ts
verified_by: test-entrypoint.ts
updated: 2026-09-27
---

# `POST /api/v1/public/products/:handle/checkout`

## Summary

Reserves inventory transactionally and creates a Stripe Checkout session from the persisted product price.

## Request

Body contains only `productId`, `quantity`, and `customerEmail`; `Idempotency-Key` is required. Client price, currency, name, and inventory values are ignored.

## Response

`201 Created` returns `{ "id": "...", "status": "pending_payment", "url": "https://checkout.stripe.com/..." }`.

## Errors

`400 INVALID_ORDER` or `IDEMPOTENCY_REQUIRED`, `404 CREATOR_NOT_FOUND` / `PRODUCT_NOT_FOUND`, `409 OUT_OF_STOCK` / `IDEMPOTENCY_IN_PROGRESS`, `429` rate limit, or `503 CHECKOUT_UNAVAILABLE`.

## Evidence

```bash
curl -sS -w '\nHTTP %{http_code}\n' -X POST http://localhost:3987/api/v1/public/products/elena/checkout
```

Observed response without a valid request: `{ "status": "error", "error": "INVALID_ORDER" }`, HTTP `400`.

## Frontend wiring

`ProductStoreModal` submits the product ID and quantity, then redirects to the server-returned Stripe URL. It never calculates or sends a price.
