# RALOA API contracts

The server is the authority for authentication, billing, referrals, domains,
telemetry, analytics, and all writes that affect another user or public data.
The route files in `docs/api/endpoints/` are the contract inventory generated
from `server.ts`. `planned` means the route exists but still needs a dedicated
contract test and captured evidence before it is promoted to `implemented`.

## Client seam

Use `src/api/client.ts` for browser calls that have a typed client contract.
It normalizes both the legacy `{ error: string }` response and the structured
`{ error: { code, message } }` response into `ApiClientError`.

## Verification

```bash
npm run check:api
npm run lint
npm run build
```

The checker fails on route drift or missing endpoint documents. It reports
unproven routes as warnings so a contract test can be added without hiding
coverage gaps.
