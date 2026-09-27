# Site/editor PostgreSQL migration

## Scope

PostgreSQL is the target authority for site configuration, handles, design JSONB, blocks, SEO fields, and publication state. Firestore remains intact and remains the default runtime until the cutover gates pass.

The compatibility interface is [`SitePersistenceRepository`](../server/repositories/site-persistence.ts). Implementations:

- Firestore: `createFirestoreSitePersistenceRepository`;
- PostgreSQL: `createPostgresSitePersistenceRepository`;
- runtime selection: `SITES_POSTGRES_AUTHORITATIVE=true` plus the PostgreSQL runtime, defaulting to Firestore when unset.

## Data mapping

| Firestore | PostgreSQL |
|---|---|
| `users/{uid}` | `app_users.external_auth_id`, `accounts`, `account_memberships` |
| `users/{uid}/sites/{siteId}` | `sites.legacy_site_id` plus `sites.content` JSONB |
| `username` | `sites.handle` with unique constraint |
| full site document | `sites.content`, `site_drafts.content`, `published_site_snapshots.content` |
| `designTokens`/design fields | `design_config` JSONB and preserved site content JSONB |
| `links`/blocks | `site_blocks.config` JSONB, ordered by `position` |
| `isPublished` | `sites.is_published` plus current immutable snapshot |
| `site_slug_redirects` | PostgreSQL `site_slug_redirects` |
| `revision` | optimistic version in site content and `site_drafts.revision` |

The original Firestore document is preserved in the JSONB content during migration so unknown/forward-compatible fields are not dropped. Queryable ownership, handle, publication state, and timestamps are relational columns.

## Autosave and concurrency

The existing `PUT /api/sites/:siteId` contract remains unchanged. `expectedRevision` is checked while the PostgreSQL site row is locked. A successful save increments the revision and writes the site row plus draft, block projection, and optional published snapshot in one transaction. A stale revision returns the existing `SITE_VERSION_CONFLICT` response with the latest site payload.

Handle uniqueness is enforced twice: an early repository lookup provides a useful response, while the PostgreSQL unique index is the final concurrent-writer guard. Handle redirects are inserted in the same transaction as the site update.

## Backfill

```bash
POSTGRES_ENABLED=true \
POSTGRES_DATABASE_URL=... \
POSTGRES_ENVIRONMENT=staging \
POSTGRES_SSL=true \
npm run migrate:sites
```

The backfill is idempotent by `app_users.external_auth_id`, `sites.legacy_site_id`, `(site_id, revision)`, and current snapshot uniqueness. It reports user/site/draft/snapshot counts and conflicts. It exits non-zero for unresolved conflicts and never deletes Firestore data.

## Reconciliation

`test-site-migration.ts` covers normalized handle, publication, revision, and content-hash comparisons. Production reconciliation must additionally:

1. compare Firestore and PostgreSQL user/site row counts;
2. compare every legacy site ID and normalized handle;
3. compare revision and publication state;
4. compare normalized JSONB content/design/block projections;
5. report duplicate handles, missing owners, missing snapshots, and hash differences;
6. block authority enablement on any mismatch.

## Cutover gates

Enable `SITES_POSTGRES_AUTHORITATIVE` only after all gates pass for the target tenant/site cohort:

- migrated row counts match;
- all ownership, handle, JSONB, draft, block, and snapshot integrity checks pass;
- autosave/reload tests pass, including stale-write conflict behavior;
- public profile output and metadata match the Firestore baseline;
- publish/unpublish and slug redirect behavior match;
- shadow-read mismatch rate is zero for the observation window;
- rollback flag and Firestore read path are verified.

The first production rollout should enable the flag per tenant/site, monitor latency/error/reconciliation metrics, and retain Firestore as rollback authority until the retention window closes.

