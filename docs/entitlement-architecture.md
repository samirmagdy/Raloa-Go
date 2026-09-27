# Entitlement architecture

Entitlements are resolved by one server-side service:
[`server/domains/billing/entitlement-service.ts`](../server/domains/billing/entitlement-service.ts).

These concepts remain separate:

- **Provider state**: Stripe customer/subscription IDs, provider status, price, renewal, and webhook
  observations.
- **Subscription state**: the internal lifecycle and billing state derived from provider events and
  reconciliation.
- **Entitlements**: the server decision about effective plan capabilities, limits, and feature
  access. Failed payment, cancellation, or expired referral access can reduce effective plan access.
- **UI availability**: the normalized capability snapshot returned to Studio so it can explain what
  is available. It is never a security boundary.

`GET /api/account/billing` exposes the normalized entitlement result with `null` for unlimited
limits, stable capability names, and an evaluation timestamp. Studio may hide controls based on this
response, but every protected write or provider action resolves/asserts entitlements again on the
server. Client-submitted plan, capability, or feature flags are ignored.

The service is the only place that converts authoritative billing state into capabilities. New
protected features must add a capability or limit there and call `assertEntitled`/`assertLimit` in
the application service or controller boundary. Billing webhooks and reconciliation update billing
state; they do not directly mutate UI flags.

The normalized contract is validated by the shared schema package, and behavior is covered by
`npm run test:entitlement-service`.
