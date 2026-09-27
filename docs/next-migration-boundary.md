# Incremental Next.js migration boundary

## Route ownership

| Surface | Current owner | Migration decision |
| --- | --- | --- |
| `/@handle` public creator pages | Express catch-all + Vite hydration | First Next candidate: SSR page data, metadata, cache headers, and streaming are valuable here. |
| Custom-domain public pages | Express host resolution + catch-all | Migrate after the public adapter supports verified host/site resolution. |
| `/templates`, `/pricing`, `/features`, `/guides` | Vite marketing shell | Optional later migration; no need to move them with creator pages. |
| `/studio`, `/dashboard`, `/analytics`, `/settings` | Vite React Studio | Keep on Vite until a product-driven workflow requires migration. |
| `/api/*` and webhooks | Express backend | Remain a backend contract; Next consumes these APIs or server adapters. |

## Adapter contract

`server/public-site/adapter.ts` exposes the only server-side seam a future Next
route needs: `loadPage(handle)`, `getMetadata(page)`, and `cacheControl`.
It returns the shared `PublicCreatorPage` contract from
`src/public-site/contract.ts`, so Next server components do not import Vite
routing, authentication, Studio state, or Firestore collections.

The future route can use the equivalent of:

```ts
const page = await publicCreatorAdapter.loadPage(params.handle);
const metadata = page ? publicCreatorAdapter.getMetadata(page) : notFound();
```

The public page should use `revalidate = 60` (or the adapter cache policy),
while booking, contact, newsletter, telemetry, and product checkout continue
through the existing API client. Interactive booking/store widgets can remain
client components during the first migration.

## Migration rule

Deploy the Next public route behind a narrow `/@handle` routing rule or a
separate public origin. Keep `/studio` and all authenticated routes on the Vite
application. Remove the Express public catch-all only after the Next route has
passed metadata, custom-domain, locale, 404/503, booking, analytics, and
cache-invalidation checks.
