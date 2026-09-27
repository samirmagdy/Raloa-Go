# RALOA Go-Live Runbook

## Required production configuration

Configure these in Cloud Run Secret Manager or the deployment environment. Never commit them:

```text
APP_URL=https://raloa.app
AUTH_SESSION_SECRET=<random 32+ character secret>
INTEGRATION_ENCRYPTION_KEY=<separate random 32+ character secret>
FIREBASE_PROJECT_ID=gen-lang-client-0319129908
FIRESTORE_DATABASE_ID=ai-studio-raloadesignfirst-8ccbe7ea-5af1-4106-809a-71252bddde6f
FIREBASE_STORAGE_BUCKET=gen-lang-client-0319129908.firebasestorage.app
FIREBASE_ADMIN_ENABLED=true
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_PRO_MONTHLY
STRIPE_PRICE_PRO_YEARLY
STRIPE_PRICE_STUDIO_MONTHLY
STRIPE_PRICE_STUDIO_YEARLY
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ZONE_ID
TRUSTED_PROXY_HOPS=1
```

Cloud Run must provide `K_SERVICE` (automatic) or a valid
`GOOGLE_APPLICATION_CREDENTIALS` path for Firebase Admin credentials. The
startup validator rejects missing values, local URLs, placeholder secrets,
Stripe test keys, incomplete provider groups, and invalid proxy/domain values.

Optional configuration includes `GEMINI_API_KEY`, `VITE_ANALYTICS_ENDPOINT`,
`SENTRY_DSN`, Resend notifications, Google/Outlook Calendar OAuth, and GitHub
OAuth. Optional provider settings must be supplied as complete groups when
enabled.

## Local verification

```bash
npm ci --legacy-peer-deps
npm run lint
npm run validate:production
npm run build:production
npx tsx test-entrypoint.ts
npx tsx test-modules-2-4.ts
```

`npm run validate:production` runs with `NODE_ENV=production` and fails with
the exact missing or invalid variable names. The server repeats the same guard
before initializing Firebase, Stripe, or Cloudflare, so a misconfigured
revision cannot start serving traffic.

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
   --set-env-vars NODE_ENV=production,APP_URL=https://raloa.app,FIREBASE_PROJECT_ID=gen-lang-client-0319129908,FIRESTORE_DATABASE_ID=ai-studio-raloadesignfirst-8ccbe7ea-5af1-4106-809a-71252bddde6f,FIREBASE_STORAGE_BUCKET=gen-lang-client-0319129908.firebasestorage.app,FIREBASE_ADMIN_ENABLED=true
```

Attach the secrets with `--set-secrets` in the real deployment command. Use a new Cloud Run revision for every release and keep the previous revision available for rollback.

## Stripe activation

The test-mode catalog currently created for RALOA is:

```text
RALOA Pro monthly:  price_1UJCNXJLQtDaoIg39sZl7nbc
RALOA Pro yearly:   price_1UJCNbJLQtDaoIg33tBI6sot
RALOA Studio monthly: price_1UJCNfJLQtDaoIg31erqWcyh
RALOA Studio yearly:  price_1UJCNiJLQtDaoIg3DwLEzCvu
```

These IDs are test-mode only. Do not use them with live Stripe credentials.

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

## Post-deployment smoke verification

Run the safe checks against the deployed origin first:

```bash
PRODUCTION_SMOKE_BASE_URL=https://raloa.app \
SMOKE_PUBLIC_HANDLE=the-disposable-published-handle \
SMOKE_BEARER_TOKEN="$SMOKE_FIREBASE_ID_TOKEN" \
npm run smoke:production
```

The command verifies health/readiness, required production configuration as
reported by readiness, authenticated session handling, Firestore-backed site
listing, public page/API resolution, Stripe signature rejection, OAuth callback
error handling, sitemap, and robots.txt. `SMOKE_STRICT=true` makes missing
verification inputs fail instead of silently passing.

Write checks are disabled by default. To verify publishing, analytics,
booking, checkout, or Cloudflare provisioning, use a disposable site/account
and explicitly opt in:

```bash
SMOKE_ALLOW_WRITES=true \
SMOKE_ALLOW_EXTERNAL_MUTATIONS=true \
SMOKE_DISPOSABLE_DATA_CONFIRMATION=I_UNDERSTAND \
SMOKE_SITE_ID=disposable-site-id \
SMOKE_BOOKING_DATE=2030-01-15 \
SMOKE_BOOKING_SERVICE_ID=service-id \
SMOKE_TEST_EMAIL=smoke-inbox@example.test \
SMOKE_DOMAIN_HOSTNAME=smoke-domain.example.com \
SMOKE_REQUIRE_OAUTH=true \
PRODUCTION_SMOKE_BASE_URL=https://raloa.app \
SMOKE_PUBLIC_HANDLE=disposable-handle \
SMOKE_BEARER_TOKEN="$SMOKE_FIREBASE_ID_TOKEN" \
npm run smoke:production
```

The booking check cancels its created booking. Domain checks remove the
provisioned hostname after verification. Product checkout intentionally leaves
a pending disposable order because Stripe checkout sessions must be reconciled
by Stripe/webhook lifecycle rules; do not run it against a real customer or
production inventory. Successful OAuth token exchange still requires a real
provider account and callback authorization; the smoke check validates provider
authorization URL generation and safe callback failure handling.

## Mandatory staging integration gate

`npm run release:verify` does not skip external dependencies. It runs
`npm run test:integration:staging`, which performs real authenticated staging
flows against Firestore, object storage, Stripe, Cloudflare, one configured
Google/Outlook Calendar provider, notification delivery, publishing, analytics,
booking, and public resolution. Use a disposable staging creator/site and
disposable product/domain data only:

```text
STAGING_BASE_URL=https://staging.example.com
STAGING_BEARER_TOKEN=<Firebase ID token for the disposable creator>
STAGING_SITE_ID=<owned disposable site ID>
STAGING_PUBLIC_HANDLE=<published disposable handle>
STAGING_TEST_EMAIL=<test inbox address>
STAGING_CALENDAR_CASES='[{"provider":"google","siteId":"google-site","publicHandle":"google-staging","serviceId":"service-id","date":"2030-01-15","slotIndex":0},{"provider":"outlook","siteId":"outlook-site","publicHandle":"outlook-staging","serviceId":"service-id","date":"2030-01-15","slotIndex":0}]'
STAGING_STRIPE_WEBHOOK_BODY=<signed disposable Stripe event body>
STAGING_STRIPE_WEBHOOK_SIGNATURE=<matching Stripe-Signature header>
STAGING_PRODUCT_ID=<active disposable product ID>
STAGING_DOMAIN_HOSTNAME=<disposable hostname delegated to Cloudflare>
STAGING_DISPOSABLE_DATA_CONFIRMATION=I_UNDERSTAND
```

The command fails before making requests when any value is missing, and fails
when a provider job, email notification, webhook, storage operation, domain
operation, or public resolution is not completed. The release gate also
requires `PRODUCTION_SMOKE_BASE_URL` plus the strict smoke inputs documented
above; no critical integration check is converted into a skip in release mode.

## Rollback

If checkout, authentication, publishing, or domain routing fails, route Cloud Run traffic back to the previous healthy revision. Do not disable webhook signature verification or Firestore rules to recover. Fix forward with a new revision after preserving the failing revision logs and request IDs.
