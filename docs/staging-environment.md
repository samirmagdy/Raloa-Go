# Production-like staging environment

Staging is a separate, real-provider environment. It is not a collection of mocks and it must never share mutable resources, credentials, webhook endpoints, queues, buckets, domains, or databases with production.

## Required isolation

| Capability | Staging resource | Isolation rule |
| --- | --- | --- |
| PostgreSQL | Dedicated database/instance and Secret Manager secret | `POSTGRES_ENVIRONMENT=staging`; TLS required; no production connection string |
| Firebase Auth/Firestore | Dedicated Firebase project and database | staging users and Firestore documents only; production Firebase project is forbidden |
| R2 | Dedicated bucket and CDN hostname | bucket starts with `STAGING_RESOURCE_PREFIX`; no production bucket access |
| Stripe | Test-mode account/catalog/webhook endpoint | only `sk_test_` keys and test prices; separate webhook signing secret |
| Cloudflare | Staging zone or delegated test subdomain | test hostnames only; scoped token limited to staging zone/R2 |
| Cloud Tasks | Dedicated project/queue and worker service | queue starts with `STAGING_RESOURCE_PREFIX`; worker URL is staging-only |
| Sentry | Staging project/environment | `APP_ENV=staging`, separate alert routing and release namespace |
| Google/Microsoft calendars | Dedicated OAuth apps and disposable calendars | callback URLs use staging host; test accounts only |
| Email | Provider staging domain/sandbox recipients | no production sender domain or recipient lists |

The validator rejects production hostnames, live Stripe keys, non-staging queue/bucket names, disabled Secret Manager, non-TLS PostgreSQL, and incomplete calendar/email configuration.

## Provisioning checklist

1. Create a dedicated GCP staging project, Firebase staging project, Secret Manager secrets, KMS key, Cloud Run service accounts, and Cloud Tasks queue plus dead-letter policy.
2. Create a dedicated PostgreSQL database, apply migrations with `POSTGRES_ENVIRONMENT=staging`, verify the migration ledger, and grant access only to staging API/worker identities.
3. Create a Cloudflare staging zone or delegate `staging.example.raloa.app`; create a scoped API token and a dedicated R2 bucket with a staging CDN hostname.
4. Create Stripe test products/prices and a test-mode webhook endpoint targeting the staging API. Store the test secret and signing secret only in the staging Secret Manager project.
5. Register separate Google and Microsoft OAuth applications with staging callback URLs. Use disposable calendars and accounts; do not authorize production calendars.
6. Configure the email provider’s staging sender/domain and suppression/test recipient policy. Store the API key in staging Secret Manager.
7. Create a Sentry staging project and configure server, worker, browser, and Next.js DSNs with `APP_ENV=staging`.
8. Set GitHub’s `staging` environment secrets and deploy with the staging Cloud Run service names. The renderer must receive `DEPLOY_ENVIRONMENT=staging`, `DEPLOY_APP_URL`, `DEPLOY_RESOURCE_PREFIX`, and staging service names.

## Validation and deployment

```bash
npm run validate:staging
npm run db:migrate
npm run db:migrate:verify
npm run test:integration:staging
npm run test:integration:staging:creator-flow
npm run smoke:production
```

The staging integration suite performs real Firebase bearer authentication, PostgreSQL-backed state checks, R2 upload/delete, Stripe test webhook and checkout operations, Cloudflare domain operations, Cloud Tasks delivery, Sentry event delivery, email delivery, and disposable Google/Microsoft calendar synchronization. A run is invalid if provider credentials are absent; it must not silently fall back to mocks.

All test records use a run ID and are deleted or expired in cleanup. Stripe test objects, calendar events, Cloudflare hostnames, R2 objects, task payloads, and email messages are tagged with the run ID for reconciliation.

## Secret naming

In the dedicated staging Secret Manager project, use the same logical names as runtime variables (`POSTGRES_DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `MICROSOFT_CALENDAR_CLIENT_SECRET`, `RESEND_API_KEY`, and `AUTH_SESSION_SECRET`). Production uses a different project and independently rotated values.

## Rollback and failure handling

Deploy staging services independently and keep the prior Cloud Run revision. Stop traffic or disable the affected queue/provider when a real-provider check fails; preserve transactional state and reconcile external objects before retrying. Never “fix” a provider failure by returning an empty collection or by switching staging to production credentials.
