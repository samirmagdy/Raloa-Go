# Database migration operations

SQL migrations under [`db/migrations`](../db/migrations) are versioned release artifacts. They are reviewed with the application change, validated in CI, applied from the exact commit being promoted, and verified before any service deployment assumes the new schema.

## Authoring contract

Every migration must:

- use an ordered filename such as `002_add_booking_index.sql`;
- declare `-- compatibility: expand`;
- contain an explicit `BEGIN`/`COMMIT` marker;
- be backward-compatible with both the previous application and the new application;
- avoid destructive operations, renames, truncation, and `CREATE INDEX CONCURRENTLY` inside the transactional runner.

Use expand/contract changes: add nullable columns or new tables first, deploy code that can read both shapes, backfill asynchronously, switch reads/writes, and remove obsolete structures only in a separately approved cleanup migration after the old release is no longer rollbackable.

## Deployment protocol

1. `npm run check:migrations` validates filenames, transaction markers, compatibility metadata, and destructive-operation policy.
2. The staging migration job runs `npm run db:migrate` from the immutable commit. The runner acquires `pg_try_advisory_lock`, records checksums in `schema_migrations`, wraps the migration and ledger write in one transaction, and emits structured start/success/failure logs.
3. `npm run db:migrate:verify` fails if any expected migration is missing, changed, or if the database contains an unknown migration. Only then can staging deploy and provider/smoke tests run.
4. Production repeats migration and verification after staging gates pass. The production service deployment depends on that successful job, so a failed or interrupted migration cannot be hidden by a new application revision.

The lock is session-scoped and fails closed when another migration is running. Retry the migration job after the owning process exits; do not run two migration commands concurrently.

## Rollback and forward fix

Schema rollback is not a destructive reverse-SQL operation. If the application deployment fails after a migration, route traffic back to the previous compatible revision while retaining the expanded schema. If the migration itself fails, the transaction rolls back and the failed statement is fixed in a new commit.

For an already committed schema change, create a forward-fix migration. Preserve existing columns/data, deploy compatibility code, repair or backfill in bounded batches, and add reconciliation checks before removing anything. Record the incident, migration version, checksum, affected release, and verification output.

## Monitoring

Monitor structured events `migration_lock_acquired`, `migration_started`, `migration_succeeded`, `migration_failed`, and `migration_verification_failed`. Alert on migration failures, lock contention, verification failures, migration duration above the release budget, and readiness/smoke failures immediately after deployment. Keep the migration job logs and `schema_migrations.applied_at` timestamps with the release record for audit and reconciliation.
