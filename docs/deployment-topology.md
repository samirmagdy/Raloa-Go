# Deployment topology

The production topology separates delivery, authenticated application traffic, asynchronous work, and data ownership. The current Express/Vite image is retained as a compatibility image while the services are split operationally; the public deployment applies a route allowlist so private Studio/API and webhook endpoints are not exposed through the public origin.

Staging renders the same topology into a dedicated GCP project with service names prefixed by `STAGING_RESOURCE_PREFIX` (for example `raloa-staging-ci-public-web`, `raloa-staging-ci-studio-api`, and `raloa-staging-ci-background-worker`). It uses a separate Firebase project, PostgreSQL database, R2 bucket, Cloud Tasks queue, Cloudflare zone/hostname, Stripe test-mode endpoint, Sentry environment, calendar OAuth applications, and email sender domain. Production service names and credentials are never used by the staging deployment.

```text
Internet/CDN
    |
    +--> raloa-public-web  (public profiles, metadata, public APIs)
    |
    +--> raloa-studio-api  (Firebase Auth, Studio/API, Stripe webhooks)
                               |
                               +--> PostgreSQL transactional domains
                               +--> Firestore editor/realtime compatibility
                               +--> Cloud Tasks / Pub/Sub
                                         |
                                         +--> raloa-background-worker
                                                  +--> Stripe / Cloudflare
                                                  +--> Google Calendar / Microsoft Graph
                                                  +--> email / media providers

Analytics events --> queue --> BigQuery/raw analytics + PostgreSQL rollups
Media originals/variants -------------------------------> Firebase Storage/R2 + CDN
Secrets -----------------------------------------------> Secret Manager + Cloud KMS
```

## Components and ownership

| Component | Deployment | Scaling | Network boundary | Data/provider access | Owner |
| --- | --- | --- | --- | --- | --- |
| Public web | `raloa-public-web` | min 1, max 20, concurrency 80 | Public ingress; only public API prefixes pass the route allowlist | Published site reads, CDN/media URLs, public booking/forms/analytics | Web platform |
| Studio/API | `raloa-studio-api` | min 1, max 30, concurrency 40 | Public/API gateway ingress; authenticated routes and Stripe webhook | Firebase Auth, repositories, PostgreSQL/Firestore, provider adapters, task dispatch | Backend platform |
| Background workers | `raloa-background-worker` | min 0, max 20, concurrency 1 | Internal ingress only; Cloud Tasks/Pub/Sub identity or worker token | Transactional repositories, outbox/jobs, provider APIs, KMS decrypt | Backend/platform operations |
| PostgreSQL | Managed private transactional database | Provider HA/read replicas as needed | Private egress only from API/workers | Booking, inventory, orders, billing, integrations, domains, rollups | Data platform |
| Analytics storage | BigQuery or equivalent | Managed analytical scaling | Service-account-only ingestion/query | Raw append events and bounded rollups | Data/analytics |
| Media storage | Firebase Storage or Cloudflare R2 | Provider-managed object scaling + CDN | Signed server operations; public CDN delivery only | Originals, variants, thumbnails, lifecycle metadata | Media platform |
| External providers | Stripe, Cloudflare, Google, Microsoft, email | Provider-managed | Egress through adapters; no inbound provider access to database | IDs/events/tokens only through trusted adapters | Domain owners |

The manifests are executable Cloud Run templates in [`deploy/cloud-run`](../deploy/cloud-run). Replace `PROJECT_ID`, `RELEASE_ID`, `STORAGE_BUCKET`, `KMS_KEY_RESOURCE`, and service-account placeholders in deployment automation; do not commit rendered manifests containing secrets.

## Secrets and network controls

API and worker service accounts receive only the Secret Manager accessor and KMS decrypt permissions they need. The public service uses the same runtime identity during the compatibility phase but cannot expose private routes; use a narrower public identity when public reads move to a dedicated renderer. Worker ingress is internal, and Cloud Tasks dispatch uses `CLOUD_TASKS_AUTH_TOKEN`/service identity. PostgreSQL should accept connections only from the API/worker VPC connector or private service endpoint. External providers never receive database credentials.

## Rollout and rollback

1. Build one immutable image tagged with `RELEASE_ID`; run lint, unit/HTTP/contract tests, build, smoke tests, and migration checks.
2. Deploy the worker first, then API, then public web. Confirm `/health` or `/api/health`, queue delivery, webhook acceptance, and provider reconciliation.
3. Shift public traffic by CDN/Load Balancer routing. Shift Studio/API traffic only after authenticated and webhook smoke tests pass.
4. Roll back each Cloud Run service independently to its prior image revision. Keep database migrations backward-compatible and leave outbox/job consumers able to process both event versions during the rollback window.
5. If a provider integration fails, stop traffic shifting, disable the affected job kind or route, reconcile provider events, and preserve queued work for retry. Never roll back a committed transactional migration destructively.

Topology validation is available through `npm run check:deployment-topology`.
