# Audience PostgreSQL cutover

Audience management uses PostgreSQL when `POSTGRES_ENABLED=true` and a database
URL is configured. The PostgreSQL repository becomes authoritative for
subscribers and form submissions; the legacy Firestore implementation remains
only as a compatibility fallback for environments that have not enabled the
database yet.

Run the migration after sites and `app_users` have been backfilled:

```bash
npm run db:migrate
npm run migrate:audience
```

The migration resolves each Firestore record through the creator Firebase UID
and legacy site ID, preserves source/timestamp/status information, and reports
skipped records. It is idempotent on site/email for subscribers and on the
legacy submission idempotency key for forms.

## API behavior

`GET /api/creator/audience` supports `type`, `siteId`, `siteHandle`, `search`,
`status`, `from`, `to`, `limit`, and `cursor`. `total` is an exact database
count for the selected filters. `nextCursor` is a keyset cursor ordered by
`created_at DESC, id DESC`; no page is presented as the complete dataset.

Exports iterate all cursor pages until completion. They do not use a capped
query masquerading as a complete export.

Subscribers support source, tags, consent status/source, active/unsubscribed
status, timestamps, search, soft deletion, and site ownership. Form
submissions support source attribution, consent, payload fields, status,
timestamps, idempotency, search, and deletion.

Public newsletter/contact writes resolve a published site by handle in
PostgreSQL and write directly to PostgreSQL. The client does not persist
audience records in localStorage.

## Metrics

Subscriber/submission counts, active subscribers, 30-day additions, and
distinct visitor counts are calculated with SQL aggregation. Metrics are not
limited to an arbitrary first page. Analytics visitor history remains subject
to its own retention policy.

## Cutover checklist

1. Backfill `app_users`, accounts, and sites.
2. Run `migrate:audience` and inspect skipped records.
3. Reconcile Firestore and PostgreSQL counts by site and status.
4. Run Studio reload, search, pagination, update, delete, and export checks.
5. Enable PostgreSQL in production.
6. After the reconciliation window, remove the legacy Firestore audience
   fallback and its collections according to the retention/deletion policy.
