# Shared runtime schemas

Zod schemas in this directory are the framework-independent runtime contract shared by the Vite Studio, public rendering, Express API, and background workers. TypeScript types are inferred from the same schemas.

Version rules:

- schemas with a `V1` suffix are immutable contracts;
- persisted site configuration is read through `migrateSiteConfig`;
- a future persisted version must add a `...SchemaV2` and an explicit migration;
- API and worker payloads are parsed at their transport boundary;
- provider events are parsed after signature verification;
- validation errors must not expose raw credentials or provider payloads.

Keep provider SDK types, Firestore types, Express request types, and React types out of this package. The package may be imported by both browser and server code.
