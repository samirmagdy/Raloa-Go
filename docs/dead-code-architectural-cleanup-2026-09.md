# Dead-code and architectural cleanup audit

Status: **blocked for destructive cleanup**

This audit was run against the current worktree on 2026-09-28. The repository is still in a strangler migration. The requested old implementations are not dead: several are still the authoritative or compatibility implementation for live routes, workers, and deployment manifests.

## Dependency analysis

`npm ls --depth=0` completed successfully with no missing or invalid direct dependencies. A static import/reference scan found active usage for the following packages:

| Dependency | Active usage | Cleanup status |
| --- | --- | --- |
| `express` | `server.ts`, controllers, worker composition, HTTP tests | Retain until Next API parity and traffic cutover |
| `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite` | `src/main.tsx`, `src/App.tsx`, `index.html`, Vite build | Retain until all Vite routes/components migrate |
| `firebase`, `firebase-admin` | Firebase Auth plus Firestore/Storage compatibility and migration paths | Retain package family; remove only non-Auth modules after cutovers |
| `multer`, `sharp` | Legacy upload path and media processing | Retain until legacy upload path is removed and worker parity is proven |
| `stripe` | Stripe adapter, billing, commerce, webhook and tests | Retain |
| `pg`, `drizzle-orm` | PostgreSQL repositories/schema and migrations | Retain |
| `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` | R2 adapter | Retain |
| `next`, `@sentry/nextjs` | Next web foundation | Retain |
| `recharts`, `qrcode`, `motion`, `lucide-react`, `canvas-confetti`, `simple-icons` | Active Studio/landing components | Retain until component parity/removal is verified |

No dependency was removed because each candidate has a current production, migration, test, or build consumer. Removing a package based only on its legacy association would create an unresolved import or remove still-served functionality.

## Active paths that must not be deleted yet

| Requested cleanup | Current evidence | Required proof |
| --- | --- | --- |
| Firestore code | `server.ts`, `server-services.ts`, Firestore repositories/workers, staging checks, migration scripts | [Firestore decommission gate](../scripts/check-firestore-decommission.mjs) passes after all domain reconciliation |
| Firebase Storage code | Legacy media upload/sign/delete paths, avatar flow, Storage adapter/rules/config | [Media R2 gate](../scripts/check-media-r2-decommission.mjs) passes after object and rendering verification |
| Express code | `server.ts` still serves the complete API inventory and worker/internal endpoints | [Next runtime gate](../scripts/check-next-runtime-retirement.mjs) passes after API parity and cutover |
| Vite setup | `src/main.tsx` and `src/App.tsx` still serve landing, templates, public fallback, and Studio | Next route/component parity and browser equivalence pass |
| Duplicate schemas/API clients | `src/shared/schema`, `src/shared/schemas`, `src/api`, package schemas, and legacy handlers are both referenced | Contract-by-contract consumer migration, then delete only unreferenced symbols |
| Compatibility adapters/flags | `SITES_POSTGRES_AUTHORITATIVE`, `MEDIA_R2_AUTHORITATIVE`, Firestore repositories, legacy Stripe/order paths, and fallback readers are runtime-selected | Observation window shows no fallback traffic and rollback no longer requires the old path |
| Demo/fixture data | `ENABLE_DEMO_FIXTURES` is opt-in outside production; template data powers landing/templates and controlled fallback paths | Product-approved replacement or explicit removal record; do not remove active template content as “fake data” |

## High-risk dead-code false positives

- `src/PublicPageApp.tsx` is dynamically imported by `src/main.tsx` for public profile requests.
- `src/App.tsx` dynamically imports Studio, auth, templates, billing, booking, audience, analytics, and settings components.
- `server.ts` imports migration repositories, adapters, and feature-flag services at the composition root even when a flag selects the PostgreSQL implementation.
- Firebase SDK usage must be split by capability; Firebase Auth is explicitly retained.
- Migration scripts are operational tooling, not production dead code, until archive/reconciliation sign-off is complete.

## Cleanup acceptance criteria

Destructive cleanup is permitted only when all of these are true:

1. Firestore decommission gate passes.
2. Media R2 decommission gate passes.
3. Next runtime retirement gate passes.
4. A generated dependency report contains no missing imports or unused production package required by the build.
5. The full API, unit, integration, provider contract, browser, staging, and smoke suites pass.
6. Production manifests no longer reference the retired runtime or provider.
7. A rollback/archive decision is recorded and no live recovery path depends on deleted code.

Until then, this audit intentionally makes no destructive deletion. The correct next cleanup unit is one bounded domain after its migration gate passes, not a repository-wide removal of active compatibility code.

