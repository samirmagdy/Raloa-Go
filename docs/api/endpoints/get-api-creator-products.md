---
id: get-api-creator-products
method: GET
path: /api/creator/products
status: implemented
auth: bearer or session
source: server.ts
verified_by: test-entrypoint.ts
updated: 2026-09-27
---

# `GET /api/creator/products`

## Summary

Lists only products owned by the authenticated creator.

## Request

No body or query parameters. Requires the authenticated creator’s bearer token or session cookie.

## Response

`200 OK` returns `{ "products": [...] }`; Stripe identifiers are never exposed to the client.

## Errors

`401 AUTH_REQUIRED` or `503 PRODUCTS_UNAVAILABLE`.

## Evidence

```bash
curl -sS -w '\nHTTP %{http_code}\n' http://localhost:3987/api/creator/products
```

Observed response without authentication: `{ "status": "error", "error": "AUTH_REQUIRED" }`, HTTP `401`.

## Frontend wiring

`StudioProductsSettings` loads this endpoint on mount and renders loading/error/empty states.
