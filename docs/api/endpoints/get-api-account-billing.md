---
id: get-api-account-billing
method: GET
path: /api/account/billing
status: planned          # implemented | planned | deprecated
auth: <none | bearer | session | api-key>   # and what happens when it is missing
source: server.ts       # handler file, relative to project root
verified_by:             # test file that executes this route; required before status: implemented
updated: 2026-09-25        # YYYY-MM-DD, the day the behaviour was last proven
---

# `GET /api/account/billing`

## Summary

Returns the authenticated creator's server-authoritative billing state. When
Stripe is configured, the route reads the current customer subscription and
persists the observed state before deriving entitlements from the effective
plan.

## Request

No path or query parameters are required.

No request body is required.

## Response

`200 OK` returns an object with this shape (Stripe identifiers and dates are
runtime values):

```json
{ "billing": { "plan": "pro", "effectivePlan": "pro", "interval": "monthly", "state": "active", "stripeStatus": "active", "renewalDate": "<ISO date or null>", "trialEndsAt": null, "cancellationDate": null, "cancelAtPeriodEnd": false, "customerId": "<Stripe customer ID or null>", "subscriptionId": "<Stripe subscription ID or null>", "source": "stripe", "entitlements": { "maxLinks": null, "maxMedia": null, "maxUploadBytes": 26214400, "premiumTemplates": true, "analytics": true, "removeBranding": true, "customDomains": true, "studioControls": false } } }
```

`state` is one of `free`, `trial`, `active`, `grace_period`, `past_due`,
`cancellation_scheduled`, `subscription_ending`, `pending`, `failed_payment`,
or `canceled`. Dates are ISO strings or `null`; unlimited entitlement limits
are `null`.

## Errors

Every failure the frontend must handle, with the exact status and body shape:

| Status | When | Body | Client behaviour |
| --- | --- | --- | --- |
| 503 | Stripe/account billing state unavailable | `{ "error": { "code": "BILLING_STATUS_UNAVAILABLE", "message": "Billing status is temporarily unavailable." } }` | show retryable billing error |
| 401 | FILL | FILL | redirect to sign-in |
| 409 | FILL | FILL | refetch, do not retry blindly |

## Evidence

The real request that proves the behaviour above, run against the local server. Paste the command
and the observed output — never an imagined response.

```bash
curl -sS -w '\nHTTP %{http_code} in %{time_total}s\n' \
  -X GET "http://localhost:PORT/api/account/billing"
```

```json
{ "observed": "verbatim response body" }
```

The request requires authentication; unauthenticated requests return `401 AUTH_REQUIRED`.

## Frontend wiring

- **Called by**: `StudioSettingsTab` and `AccountSettingsModal`
- **Trigger**: billing section mount or explicit refresh
- **Loading state**: billing status spinner
- **Error state**: `503` displays a retryable billing error
- **Client stub**: direct authenticated `fetch('/api/account/billing')`
- **Types**: `StudioBilling` in `src/components/studio/StudioSettingsTab.tsx`
- **Idempotency / retry**: safe to retry; reads Stripe and persists the latest observation
