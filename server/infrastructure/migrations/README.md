# Firestore-to-PostgreSQL migration tooling

`MigrationRunner` provides the control plane for moving one bounded domain at a time. It is
intentionally adapter-based: callers provide Firestore and PostgreSQL source/target repositories,
normalization, and an idempotent target upsert.

The runner supports:

- resumable page-based backfills with persisted cursors and counters;
- normalized shadow reconciliation with missing, mismatched, and extra-record reports;
- explicit routing modes for source reads, shadow reads, dual writes, and target authority;
- guarded phase transitions and rollback to the source authority;
- checkpointed errors so interrupted work can resume without restarting the domain.

Production checkpoint storage must use a transactional repository backed by PostgreSQL. The memory
store exists only for unit tests. Backfill pages must be idempotent and use stable source IDs; no
source document is deleted as part of migration.
