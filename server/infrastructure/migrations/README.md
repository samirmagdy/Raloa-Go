# Firestore-to-PostgreSQL migration tooling

`MigrationRunner` provides the control plane for moving one bounded domain at a time. It is
intentionally adapter-based: callers provide Firestore and PostgreSQL source/target repositories,
normalization, and an idempotent target upsert.

`createStranglerRouter` is the request-path seam. It wraps the legacy source and new target behind
the same read/write contract, uses tenant-scoped feature flags for controlled routing, supports
source-preserving shadow reads, and supports dual writes before target authority. The source remains
the default and the router fails back to it whenever a rollout flag is disabled.

The runner supports:

- resumable page-based backfills with persisted cursors and counters;
- normalized shadow reconciliation with missing, mismatched, and extra-record reports;
- explicit routing modes for source reads, shadow reads, dual writes, and target authority;
- guarded phase transitions and rollback to the source authority;
- checkpointed errors so interrupted work can resume without restarting the domain.

Shadow comparisons must report normalized mismatches; raw document ordering, generated timestamps,
and provider-specific fields should be removed by the domain normalizer. Dual writes must be
idempotent and should be coordinated by outbox/idempotency records rather than a distributed
transaction.

Production checkpoint storage must use a transactional repository backed by PostgreSQL. The memory
store exists only for unit tests. Backfill pages must be idempotent and use stable source IDs; no
source document is deleted as part of migration.
