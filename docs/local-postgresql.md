# Local PostgreSQL

PostgreSQL is provisioned locally as the future transactional datastore. It is not used by the current Express/Firestore production read or write paths.

```bash
npm run db:local:up
npm run db:migrate:local
npm run db:health:local
npm run db:migrate:test
npm run test:postgres:integration
```

Local connection defaults to `postgresql://raloa:raloa_local_only@127.0.0.1:5432/raloa_dev`. The isolated test service uses `postgresql://raloa:raloa_test_only@127.0.0.1:5434/raloa_test`. Set `POSTGRES_DATABASE_URL` or `POSTGRES_TEST_DATABASE_URL` to use another instance. `createConfiguredPostgresDatabase()` is an explicit opt-in seam and refuses production unless `POSTGRES_ENABLED=true`.

The pool, transaction helper, schema, migration runner, and health probe live under `server/infrastructure/postgres`. No application repository is wired to this package yet; Firestore remains authoritative until a bounded migration enables a feature flag.
