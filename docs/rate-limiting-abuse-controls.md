# Rate limiting and abuse controls

Rate limits are applied by API class, not through one global bucket. The policy catalog is in
[`server/core/rate-limit-policy.ts`](../server/core/rate-limit-policy.ts).

| API class | Default limit | Identity dimensions |
| --- | ---: | --- |
| Authentication login | 5 / 10 minutes | IP + normalized account |
| Password reset | 3 / 15 minutes | IP + normalized account |
| Public forms | 5 / hour | IP + site |
| Public booking creation | 10 / hour | IP + site |
| Analytics ingestion | 120 / hour | IP + site |
| Media uploads | 20 / hour | IP + user + site |
| Domain verification | 10 / hour | IP + user + site + domain |
| Imports | 5 / hour | IP + user + site |
| Checkout creation | 10 / hour | IP + site |
| OAuth flows | 10 / 10 minutes | IP + user + provider |

The dimensions are independent: one abusive site cannot consume another tenant’s site bucket, and a
single user cannot evade limits by rotating endpoints. Authenticated limits use the verified Firebase
UID, not a client-supplied user ID. Public limits use the resolved site/handle only after validating
the published target; invalid requests still consume the IP component.

Production deployments use the distributed rate-limit store; local/test mode uses the same policy
with an in-process fallback. Responses include `429` and `Retry-After`. Expensive operations also
retain request validation, idempotency, entitlement checks, and provider-specific quotas—rate
limiting is defense in depth, not authorization.

Tests in `test-rate-limit-policy.ts` verify policy separation and required identity dimensions.
