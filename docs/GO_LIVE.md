# RALOA Go-Live Runbook

## Required production secrets

Configure these in Cloud Run Secret Manager or the deployment environment. Never commit them:

```text
GEMINI_API_KEY
APP_URL=https://raloa.app
FIREBASE_PROJECT_ID=gen-lang-client-0319129908
FIRESTORE_DATABASE_ID=ai-studio-raloadesignfirst-8ccbe7ea-5af1-4106-809a-71252bddde6f
FIREBASE_ADMIN_ENABLED=true
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_PRO_MONTHLY
STRIPE_PRICE_PRO_YEARLY
STRIPE_PRICE_STUDIO_MONTHLY
STRIPE_PRICE_STUDIO_YEARLY
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ZONE_ID
VITE_ANALYTICS_ENDPOINT
SENTRY_DSN
```

## Local verification

```bash
npm ci --legacy-peer-deps
npm run lint
npm run build
npx tsx test-entrypoint.ts
npx tsx test-modules-2-4.ts
```

## Firebase deployment

Use the project-scoped CLI so a missing global `firebase` command cannot block deployment:

```bash
npx -y firebase-tools@latest login --reauth
npx -y firebase-tools@latest use gen-lang-client-0319129908
npx -y firebase-tools@latest deploy --only firestore:rules,firestore:indexes --project gen-lang-client-0319129908
```

Before deployment, verify Email/Password and Google providers plus `raloa.app` and the Cloud Run hostname in Firebase Authentication authorized domains.

## Cloud Run deployment

```bash
gcloud builds submit --tag REGION-docker.pkg.dev/PROJECT_ID/raloa/raloa:RELEASE_ID
gcloud run deploy raloa \
  --image REGION-docker.pkg.dev/PROJECT_ID/raloa/raloa:RELEASE_ID \
  --region REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars NODE_ENV=production,APP_URL=https://raloa.app,FIREBASE_PROJECT_ID=gen-lang-client-0319129908,FIRESTORE_DATABASE_ID=ai-studio-raloadesignfirst-8ccbe7ea-5af1-4106-809a-71252bddde6f,FIREBASE_ADMIN_ENABLED=true
```

Attach the secrets with `--set-secrets` in the real deployment command. Use a new Cloud Run revision for every release and keep the previous revision available for rollback.

## Stripe activation

1. Create the live Pro and Studio monthly/yearly recurring prices.
2. Put their IDs in the four `STRIPE_PRICE_*` secrets.
3. Register `https://raloa.app/api/webhooks/stripe` as a live webhook endpoint.
4. Subscribe to checkout, subscription, and invoice payment events.
5. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
6. Run a real checkout, portal, cancellation, renewal, and failed-payment smoke test.

## Cloudflare for SaaS activation

1. Configure the zone for `raloa.app`.
2. Create a scoped API token with only the custom-hostname permissions required by the domain endpoints.
3. Store the token and zone ID as secrets.
4. Verify a test customer domain through `/api/domains/provision` and `/api/domains/verify`.
5. Confirm active SSL routing and pending/failed-domain responses.

## Smoke checks after deployment

```bash
curl -fsS https://raloa.app/api/health
curl -fsS https://raloa.app/api/readiness
curl -I https://raloa.app/
curl -I https://www.raloa.app/
curl -fsS 'https://raloa.app/api/v1/handles/check?handle=launch-test'
```

Then verify registration, Google login, publishing, image upload, custom-domain setup, Stripe Checkout, Billing Portal, webhook synchronization, referral qualification, and mobile layouts.

## Rollback

If checkout, authentication, publishing, or domain routing fails, route Cloud Run traffic back to the previous healthy revision. Do not disable webhook signature verification or Firestore rules to recover. Fix forward with a new revision after preserving the failing revision logs and request IDs.
