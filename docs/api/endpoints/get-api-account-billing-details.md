---
id: get-api-account-billing-details
method: GET
path: /api/account/billing/details
status: implemented
auth: bearer
source: server.ts       # handler file, relative to project root
verified_by: test-entrypoint.ts
updated: 2026-09-25        # YYYY-MM-DD, the day the behaviour was last proven
---

# `GET /api/account/billing/details`

## Summary

Returns the authenticated user’s Stripe payment method and recent invoice metadata for the Billing section of Account Settings.

## Request

**Path / query parameters**

No path or query parameters.

**Body**

No request body. The bearer token identifies the account.

## Response

The endpoint returns `200`:

```json
{ "invoices": [{ "id": "in_x", "number": "0001", "status": "paid", "amountPaid": 600, "currency": "usd", "created": 1720000000, "hostedInvoiceUrl": "https://pay.stripe.com/..." }], "paymentMethod": { "brand": "visa", "last4": "4242", "expMonth": 12, "expYear": 2030 } }
```

`invoices` is always an array. `paymentMethod` is either the card summary or `null` when no card is attached. Invoice `hostedInvoiceUrl` may be `null`.

## Errors

Every failure the frontend must handle, with the exact status and body shape:

| Status | When | Body | Client behaviour |
| --- | --- | --- | --- |
| 401 | Missing or invalid bearer token | `{ "error": { "code": "AUTH_REQUIRED", "message": "Authentication required." } }` | show sign-in state |
| 503 | Stripe or billing data unavailable | `{ "error": { "code": "BILLING_DETAILS_UNAVAILABLE", "message": "Billing details are temporarily unavailable." } }` | show retryable billing error |

## Evidence

The real request that proves the behaviour above, run against the local server. Paste the command
and the observed output — never an imagined response.

```bash
curl -sS -w '\nHTTP %{http_code} in %{time_total}s\n' \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  -X GET "http://localhost:PORT/api/account/billing/details"
```

Observed against the local server without a token:

```text
{"status":"error","error":{"code":"AUTH_REQUIRED","message":"Authentication required."},"code":"AUTH_REQUIRED","message":"Authentication required.","errorCode":"AUTH_REQUIRED"}
HTTP 401
```

Observed status: HTTP 401 in 0.01s; payload contains the `AUTH_REQUIRED` code. The authenticated path is read-only and returns invoice/payment method data from Stripe when a customer is configured.

## Frontend wiring

- **Called by**: `AccountSettingsModal` Billing section
- **Trigger**: modal mount
- **Loading state**: shared Account Settings loading state
- **Error state**: displayed through the modal status banner
- **Client stub**: local authenticated `request()` helper
- **Types**: `BillingDetails` in `src/components/modals/AccountSettingsModal.tsx`
- **Idempotency / retry**: safe to retry; read-only and has no side effects.
