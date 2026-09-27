# Versioned shared schemas

Zod schemas in this directory are the runtime source of truth. TypeScript types
are inferred from the same schemas and exported through `src/shared`.

Version rules:

- persisted site records are read through `migrateSiteConfig`, which accepts
  legacy records and normalizes them to v1;
- new persisted schema versions must add a new `...SchemaV2` and migration
  function rather than changing v1 in place;
- API payloads, public page data, domain events, worker payloads, and OAuth
  token contracts validate at their boundaries;
- validation errors are handled by the owning boundary and never leak secrets
  or raw provider credentials.
