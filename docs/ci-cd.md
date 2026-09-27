# CI/CD architecture

The release workflow is [`/.github/workflows/ci-cd.yml`](../.github/workflows/ci-cd.yml). A commit reaches production only after these gates pass in order:

```text
static/security -> application tests -> browser workflows -> immutable image
-> staging migration -> topology-based staging deployment
-> real staging provider tests -> staging smoke tests
-> production migration -> topology-based production deployment
-> production smoke tests
```

## Required gates

- Static: TypeScript/lint, secret scanning, persistence-boundary checks, topology checks, migration checks, and high-severity dependency audit.
- Application tests: unit/service tests, HTTP integration tests, provider contract tests, legacy compatibility tests, coverage, production configuration validation, and Playwright browser workflows.
- Database: migrations run from the immutable commit, acquire a PostgreSQL advisory lock, are checksum-tracked in `schema_migrations`, and are verified as fully applied before the corresponding service deployment. Migration files must be additive and backward-compatible with the previous release.
- Staging: checked-in Cloud Run manifests are rendered with environment-specific values, then all services are replaced from the same immutable image. Real Stripe, Firebase, storage, calendar, email, and Cloudflare checks run against disposable staging resources.
- Promotion: production migration waits for staging provider and smoke gates. Production deployment is followed by strict smoke tests for health, public rendering, authenticated API behavior, webhooks, OAuth callbacks, and queue endpoints.

Pull requests run every non-provider gate and build the image locally without publishing credentials. Pushes to `main` publish one immutable image and can promote only through protected `staging` and `production` GitHub environments.

## Environment contract

Configure OIDC deployment credentials and protected environment secrets in GitHub. Staging and production each need database URLs, Firebase project/database/bucket values, KMS key resources, Stripe price IDs, Cloudflare zone IDs, service accounts, worker task URLs, smoke credentials, and provider-test fixtures. Secret values are consumed by workflow steps or Secret Manager; they are never committed or embedded in rendered manifests.

The renderer (`npm run render:cloud-run`) turns checked-in topology templates into ephemeral manifests. This keeps resource names, probes, ingress, scaling, service accounts, and secret references reviewable while preventing deployment commands from drifting from the topology document.

## Automated rollback

Rollback is a traffic operation, not a database reversal. Identify the last known-good revision for each Cloud Run service, then run:

```sh
ROLLBACK_CONFIRM=I_UNDERSTAND \
CLOUD_RUN_REGION=REGION \
ROLLBACK_REVISIONS='raloa-public-web=PUBLIC_REVISION,raloa-studio-api=API_REVISION,raloa-background-worker=WORKER_REVISION' \
npm run deploy:rollback
```

The script shifts each service to 100% of its specified revision and fails closed when confirmation, region, or a service revision is missing. Keep migrations backward-compatible; never use rollback to destructively undo an applied schema. Afterward, run the production smoke suite, inspect job/webhook failures, and reconcile external-provider events received during the incident.

Workflow structure is checked with `npm run check:ci-cd`; deployment topology is checked with `npm run check:deployment-topology`.
