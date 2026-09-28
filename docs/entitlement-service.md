# Entitlement service

`server/domains/entitlements/service.ts` is the authoritative server-side
capability policy. Billing owns payment and subscription state; it does not
decide what the product may do. The entitlement service consumes the billing
state's `effectivePlan` and returns a normalized capability snapshot.

The snapshot includes:

- plan and limits for links, media, and upload bytes;
- premium templates, analytics, custom domains, branding, and Studio controls;
- allowed block types, backgrounds, and design options;
- provider availability for Google Calendar, Microsoft Calendar, social
  integrations, and email delivery;
- normalized Studio feature flags.

The `/api/account/billing` response exposes `capabilities` and `limits` for UI
display. Authorization and mutation endpoints still call the service on the
server through `resolve`, `assertEntitled`, or `assertLimit`; client-side
feature hiding is never the security boundary.

Subscription webhook synchronization updates the authoritative billing state in
PostgreSQL. The next entitlement resolution reads that state, so plan changes
take effect without duplicating Stripe rules in UI code.
