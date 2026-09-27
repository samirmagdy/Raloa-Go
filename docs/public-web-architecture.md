# Public web and Studio architecture

RALOA has two different workloads and should deploy them independently:

| Workload | Public web | Studio |
| --- | --- | --- |
| Audience | Anonymous visitors, crawlers, social previews | Authenticated creators and operators |
| Read/write profile | High-read published snapshots | Authenticated editing and publishing |
| Rendering | SSR/ISR or edge-rendered Next pages | Existing Vite client application |
| Caching | CDN-friendly, host-aware, short revalidation | Private/no shared caching |
| Failure mode | 404/503 public page states with stale cache where safe | Session-preserving application errors |
| API behavior | Public booking, audience, telemetry, and product APIs | Authenticated creator APIs |

The first extraction boundary is `server/public-site/adapter.ts` and
`src/public-site/contract.ts`. They share only normalized public page data and
design tokens. The public renderer does not import Studio routing, auth state,
editor components, or private repositories.

`/api/public/sites/:handle` and the existing `/@handle` response now advertise
`public, s-maxage=60, stale-while-revalidate=300` and `Vary: Host`. The short
cache window protects read throughput while allowing published changes to
converge quickly; custom-domain responses cannot leak across hosts.

The Vite Studio remains authoritative for `/studio`, `/dashboard`,
`/analytics`, `/settings`, authentication, and editor workflows. A future Next
deployment can own only `/@handle` first, proxying interactive mutations to the
existing Express APIs. No Studio migration is required for the public renderer
to ship.
