# PostgreSQL environment contract

PostgreSQL is the target authoritative application database for transactional domains. This phase provisions and validates the database foundation, but does not route application reads or writes away from Firestore.

## Environment matrix

| Environment | Connection source | SSL | Pool guidance | Migration owner | Traffic status |
|---|---|---:|---:|---|---|
| local | `POSTGRES_DATABASE_URL`, Docker Compose `postgres` | optional | max 5 | developer/CI | opt-in tooling only |
| test | `POSTGRES_TEST_DATABASE_URL`, isolated Docker Compose `postgres-test` or CI service | optional | max 2 | test setup | integration tests only |
| staging | Secret Manager `POSTGRES_DATABASE_URL` | required | sized from Cloud Run concurrency | deployment pipeline, locked | shadow/verification only |
| production | Secret Manager `POSTGRES_DATABASE_URL` | required | sized from Cloud Run concurrency and DB max connections | deployment pipeline, locked | not switched by this change |

## Required configuration

| Variable | Local/test | Staging/production |
|---|---|---|
| `POSTGRES_DATABASE_URL` | required for migrations/runtime tooling | required from Secret Manager |
| `POSTGRES_TEST_DATABASE_URL` | required for integration tests | must never point to shared production data |
| `POSTGRES_ENVIRONMENT` | `local` or `test` | `staging` or `production` |
| `POSTGRES_SSL` | `false` for local Docker | `true` |
| `POSTGRES_SSL_REJECT_UNAUTHORIZED` | optional | `true` unless managed CA policy says otherwise |
| `POSTGRES_POOL_MAX` | 5–10 | explicitly sized per instance |
| `POSTGRES_POOL_MIN` | 0 | normally 0–2 |
| `POSTGRES_IDLE_TIMEOUT_MS` | 30,000 | explicitly configured |
| `POSTGRES_CONNECTION_TIMEOUT_MS` | 5,000 | explicitly configured |
| `POSTGRES_APPLICATION_NAME` | environment-specific | service and environment name |
| `POSTGRES_ENABLED` | optional | must be `true` before any production repository is enabled |

## Pooling and Cloud Run

Each process owns one bounded `pg.Pool`. Size the pool using:

```text
max database connections >= (Cloud Run max instances × pool max) + migration/admin reserve
```

Keep provider calls outside database transactions. Use `withPostgresTransaction` for state changes that require atomicity. Never create a pool per request or job.

## Migrations and readiness

SQL files in `db/migrations` are the schema authority. The migration runner acquires a PostgreSQL advisory lock, applies each migration transactionally, stores SHA-256 checksums in `schema_migrations`, rejects modified applied migrations, and emits structured logs.

```bash
npm run db:local:up
npm run db:migrate:local
npm run db:health:local
npm run db:migrate:test
npm run test:postgres:integration
```

Readiness requires both `SELECT 1` and a readable `schema_migrations` ledger. Liveness must not be used as permission to switch application traffic.

## Logging and secrets

Pool lifecycle, transaction, migration, and health events are structured and must include environment/request/job context where available. SQL parameters, connection strings, passwords, tokens, and customer data are never logged. Production URLs are supplied through Secret Manager or platform-native secret injection.

## Test isolation

The integration suite requires a separate `POSTGRES_TEST_DATABASE_URL`. The helper rejects a URL equal to `POSTGRES_DATABASE_URL` or `DATABASE_URL`, uses a small pool, and wraps test mutations in rollback transactions. CI should provision a disposable database/service per job; tests must not share staging or production schemas.

