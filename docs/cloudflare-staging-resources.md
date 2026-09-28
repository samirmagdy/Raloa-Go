# Cloudflare staging resources

Provisioned in the authenticated Cloudflare account for staging only:

| Resource | Name | Purpose | Runtime status |
| --- | --- | --- | --- |
| R2 bucket | `raloa-staging-media` | staging media originals and variants | available; empty |
| R2 dead-letter candidate | — | not applicable | — |
| Workers Queue | `raloa-staging-jobs` | candidate async job transport | provisioned; no consumer attached |
| Workers Queue | `raloa-staging-jobs-dlq` | failed-message destination | provisioned; no consumer attached |

The R2 bucket has CORS configured for local development and the currently documented staging hostname. No public `r2.dev` URL or custom domain is enabled, so media is not unintentionally public.

The queues are not yet the application authority. Google Cloud Tasks remains the current production job platform until the Cloudflare Queue adapter, Worker consumer, PostgreSQL job-state integration, idempotency tests, and staging worker validation pass. This is deliberate: creating a queue must not silently redirect production jobs.

## Reconciliation commands

```bash
npx wrangler r2 bucket info raloa-staging-media
npx wrangler r2 bucket cors list raloa-staging-media
npx wrangler queues info raloa-staging-jobs
npx wrangler queues info raloa-staging-jobs-dlq
npx wrangler queues list
```

## Next controlled step

Create a small Cloudflare Worker consumer that accepts the existing versioned job envelope, validates the internal signature, claims the PostgreSQL job idempotency key, and forwards/executes only approved job kinds. Attach it with the settings in [queues-staging.json](../infra/cloudflare/queues-staging.json), then run the provider contract and staging job tests before enabling any production flag.
