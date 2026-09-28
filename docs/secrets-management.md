# Production secrets management

Production secret values are loaded during server bootstrap from Google Secret Manager when `SECRET_MANAGER_ENABLED=true`. Secret names default to the server-only environment variable name; deployments may override a name with `SECRET_MANAGER_SECRET_<ENV_NAME>`.

Managed secrets include `AUTH_SESSION_SECRET`, Stripe credentials, the Cloudflare API token, Google/Microsoft/GitHub OAuth client secrets, `RESEND_API_KEY`, PostgreSQL connection URLs, and Cloudflare R2 access keys. Production and staging use the non-secret `INTEGRATION_KMS_KEY_NAME` to select the Cloud KMS key. Runtime startup fails if any enabled managed secret or KMS configuration cannot be read. Local development and tests may use `.env` values with `SECRET_MANAGER_ENABLED=false`, but those values must never be used for staging or production.

## Provisioning and rotation

Create each secret in the production project, grant the Cloud Run runtime service account `roles/secretmanager.secretAccessor`, and deploy only non-secret references:

```bash
gcloud secrets create STRIPE_SECRET_KEY --replication-policy=automatic
printf '%s' "$STRIPE_SECRET_KEY_VALUE" | gcloud secrets versions add STRIPE_SECRET_KEY --data-file=-
gcloud run services update raloa --update-env-vars SECRET_MANAGER_ENABLED=true,SECRET_MANAGER_PROJECT_ID=raloa-production
```

Secret values must not appear in shell history, CI/build logs, deployment manifests, repositories, Vite `VITE_*` variables, API responses, audit metadata, structured logs, Sentry context, or provider error payloads.

For rotation, add a new KMS key version or key reference, restart/deploy instances, exercise provider health and reconciliation checks, then re-encrypt records as a bounded migration. Each new envelope stores its KMS key reference, so old records remain decryptable during the migration. The pre-envelope `INTEGRATION_LEGACY_ENCRYPTION_KEY` may be loaded temporarily from Secret Manager by setting `SECRET_MANAGER_SECRET_INTEGRATION_LEGACY_ENCRYPTION_KEY`; remove it after all legacy records are rewritten. Stripe webhook signing secrets and OAuth client secrets require provider-side rotation and reconnect/revocation handling.

Run `npm run check:secrets`, `npm run validate:production`, and provider smoke tests after each rotation. The repository scan is a guardrail; Secret Manager IAM and provider dashboards remain operational sources of truth.
