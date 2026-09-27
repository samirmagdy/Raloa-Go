# Testing architecture

Tests are organized by the boundary they prove. A lower layer must not require a higher layer or a live provider.

| Layer | Tool | Scope | External services |
| --- | --- | --- | --- |
| Unit/domain/service | Vitest | State machines, validation, authorization, services, repositories with fakes | None |
| HTTP integration | Vitest + Supertest | Express routing, middleware, auth/error envelopes, idempotency and tenant scoping | Emulator/fake repositories only |
| Browser workflow | Playwright | Studio/public workflows, responsive states, recovery paths | Mocked API by default; disposable environment for opt-in live runs |
| Provider contract | Vitest | Adapter method shape, normalized responses/errors, retry/idempotency behavior | Provider SDKs mocked; no credentials |
| Staging integration | Existing Node staging runner | Real Stripe, Cloudflare, Firebase/Firestore, Storage, email, Google/Microsoft calendar, and media flows | Disposable staging resources and explicit opt-in credentials |

## Commands

```bash
npm run test:unit
npm run test:http
npm run test:contracts
npm run test:e2e
npm run test:integration:staging
```

`test:unit`, `test:http`, and `test:contracts` are deterministic CI gates. Playwright runs against the built application and uses route mocks for stable Studio tests. Staging tests are never part of pull-request unit runs; they require `STAGING_*` configuration and disposable resource confirmation.

## Harness guarantees

Vitest suites share `tests/setup.ts`, which fixes UTC time, resets mocks, restores timers, and keeps tests isolated in forked workers. Reusable tenant/site/order fixture factories live in `tests/fixtures/factories.ts`; tests should build data through those factories instead of embedding incompatible payloads.

Coverage is collected with `@vitest/coverage-v8` by `npm run test:coverage`. The unit project starts with thresholds of 80% lines/functions/statements and 70% branches for the explicitly included domain modules. CI emits JUnit at `reports/vitest-junit.xml`, coverage reports under `reports/coverage`, and the legacy adapter emits `reports/legacy-tests.xml`.

Root-level `test-*.ts` checks are cataloged in `tests/legacy-manifest.json` and executed in isolated child processes by `npm run test:legacy` (or the suite-specific variants). This preserves valuable coverage while preventing process-global environment and fixture state from leaking between scripts. New tests must not be added to the repository root; migrate a legacy entry into `tests/<suite>/` when it is next changed.

Existing `test-*.ts` files remain compatibility checks while they are migrated into the layer-specific directories. New tests must use the appropriate Vitest project or Playwright suite rather than adding another unclassified root-level script.

Provider contract tests must verify that adapters never return raw provider SDK objects to domain services, preserve normalized error codes, and accept idempotency/retry inputs where the provider operation can be repeated. Staging tests verify the corresponding real behavior, including Stripe webhook signatures, Cloudflare DNS/domain state, Firebase auth/Firestore ownership, Storage lifecycle, email delivery, and calendar OAuth/synchronization.

The current provider contract suite covers Stripe, Cloudflare domain operations, Firebase Auth, Firestore, Firebase Storage, Cloudflare R2, Resend email, Google Calendar, and Microsoft Graph. The staging runner exercises the real Stripe checkout/webhook path, Cloudflare provision/verify/remove path, Firebase bearer-auth and Firestore reads, Firebase Storage upload/delete, real email delivery workers, and one disposable Google plus one disposable Microsoft calendar booking. Provider credentials are required only by the staging command.
