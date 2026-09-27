# Express bounded-context architecture

`server.ts` remains the compatibility composition root while route handlers are migrated in
bounded-context slices. New domain code follows this dependency direction:

```text
route/controller -> service -> domain repository -> infrastructure adapter
                         \-> validation / authorization
```

Rules for migrated code:

- Controllers only translate HTTP input/output and call a service.
- Services own business rules and may depend only on their domain repositories and provider ports.
- Repositories are the only layer allowed to know Firestore collection paths.
- Authorization is expressed through `core/authorization.ts` and ownership lookups, never by a
  controller trusting an id from the request body.
- Stripe, calendar, Cloudflare, and other external systems enter through adapters under
  `server/adapters/`.
- Domain modules do not import another domain's repository. Cross-domain work uses a service or
  provider port passed through `server/modules.ts`.

The module registry intentionally exposes route ownership in each module. This keeps the public
HTTP surface unchanged while allowing each route group to move without changing the `server.ts`
entrypoint or existing consumers.
