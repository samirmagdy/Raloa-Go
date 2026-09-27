import assert from 'node:assert/strict';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkPostgresReadiness, createIsolatedTestDatabase, withIsolatedTestTransaction } from '../../server/infrastructure/postgres/index.ts';
import { createPostgresSitePersistenceRepository } from '../../server/infrastructure/postgres/sites-repository.ts';
import { createPostgresPublishedSiteReader, createPostgresSitePublicationRepository } from '../../server/infrastructure/postgres/site-publications-repository.ts';

const configured = Boolean(process.env.POSTGRES_TEST_DATABASE_URL);
const suite = describe.skipIf(!configured);

suite('PostgreSQL integration foundation', () => {
  let database: ReturnType<typeof createIsolatedTestDatabase>;

  beforeAll(() => {
    database = createIsolatedTestDatabase();
    assert.ok(database, 'POSTGRES_TEST_DATABASE_URL must configure an isolated test database');
  });

  afterAll(async () => {
    await database?.pool.end();
  });

  it('reports connectivity and applied schema readiness', async () => {
    const readiness = await checkPostgresReadiness(database!.pool);
    expect(readiness.ok).toBe(true);
    expect(readiness.schemaReady).toBe(true);
    expect(readiness.latestMigration).toMatch(/^00[1-9]/);
  });

  it('supports transaction rollback isolation for test data', async () => {
    const marker = `postgres-test-${Date.now()}`;
    await withIsolatedTestTransaction(database!.pool, async (client) => {
      await client.query('INSERT INTO app_users (external_auth_id, email) VALUES ($1, $2)', [marker, `${marker}@example.test`]);
      const inserted = await client.query('SELECT external_auth_id FROM app_users WHERE external_auth_id = $1', [marker]);
      expect(inserted.rowCount).toBe(1);
    });
    const afterRollback = await database!.pool.query('SELECT external_auth_id FROM app_users WHERE external_auth_id = $1', [marker]);
    expect(afterRollback.rowCount).toBe(0);
  });

  it('preserves site repository ownership, slug uniqueness, and optimistic concurrency', async () => {
    const marker = `site-repository-${Date.now()}`;
    let appUserId = '';
    let accountId = '';
    try {
      const seeded = await database!.pool.query<{ user_id: string; account_id: string }>(
        `WITH new_user AS (
           INSERT INTO app_users (external_auth_id, email) VALUES ($1, $2) RETURNING id
         ), new_account AS (
           INSERT INTO accounts (primary_user_id, name)
           SELECT id, $3 FROM new_user RETURNING id, primary_user_id
         )
         INSERT INTO account_memberships (account_id, user_id, role)
         SELECT id, primary_user_id, 'owner' FROM new_account
         RETURNING user_id, account_id`,
        [marker, `${marker}@example.test`, marker]
      );
      appUserId = seeded.rows[0].user_id;
      accountId = seeded.rows[0].account_id;

      const repository = createPostgresSitePersistenceRepository(database!.pool);
      const siteId = `${marker}-site`;
      const initialSite = { id: siteId, username: `${marker.slice(0, 20)}-site`, displayName: 'Initial', links: [], revision: 1, isPublished: false };
      await repository.create(marker, siteId, initialSite);

      const owned = await repository.getOwned(marker, siteId);
      expect(owned?.data.username).toBe(initialSite.username);
      expect(await repository.isHandleTaken(initialSite.username, marker, siteId)).toBe(false);
      expect(await repository.isHandleTaken(initialSite.username, 'different-tenant')).toBe(true);

      const saved = await repository.saveVersioned({
        userId: marker,
        siteId,
        site: { ...initialSite, displayName: 'Updated' },
        previousHandle: initialSite.username,
        nextHandle: initialSite.username,
        expectedRevision: 1
      });
      expect(saved.status).toBe('saved');
      expect(saved.site?.revision).toBe(2);

      const stale = await repository.saveVersioned({
        userId: marker,
        siteId,
        site: { ...initialSite, displayName: 'Stale write' },
        previousHandle: initialSite.username,
        nextHandle: initialSite.username,
        expectedRevision: 1
      });
      expect(stale.status).toBe('version_conflict');
      expect(stale.site?.displayName).toBe('Updated');
    } finally {
      if (accountId) {
        await database!.pool.query('ALTER TABLE audit_log DISABLE TRIGGER audit_log_append_only');
        try { await database!.pool.query('DELETE FROM audit_log WHERE site_id IN (SELECT id FROM sites WHERE account_id = $1)', [accountId]); }
        finally { await database!.pool.query('ALTER TABLE audit_log ENABLE TRIGGER audit_log_append_only'); }
      }
      if (accountId) await database!.pool.query('ALTER TABLE published_site_snapshots DISABLE TRIGGER published_site_snapshots_append_only');
      if (accountId) await database!.pool.query('ALTER TABLE published_site_snapshots DISABLE TRIGGER published_site_snapshots_append_only');
      if (accountId) await database!.pool.query('DELETE FROM sites WHERE account_id = $1', [accountId]);
      if (accountId) await database!.pool.query('ALTER TABLE published_site_snapshots ENABLE TRIGGER published_site_snapshots_append_only');
      if (accountId) await database!.pool.query('ALTER TABLE published_site_snapshots ENABLE TRIGGER published_site_snapshots_append_only');
      if (accountId) await database!.pool.query('DELETE FROM accounts WHERE id = $1', [accountId]);
      if (appUserId) await database!.pool.query('DELETE FROM app_users WHERE id = $1', [appUserId]);
    }
  });

  it('keeps public reads on immutable snapshots while drafts autosave', async () => {
    const marker = `site-publication-${Date.now()}`;
    let appUserId = '';
    let accountId = '';
    try {
      const seeded = await database!.pool.query<{ user_id: string; account_id: string }>(
        `WITH new_user AS (
           INSERT INTO app_users (external_auth_id, email) VALUES ($1, $2) RETURNING id
         ), new_account AS (
           INSERT INTO accounts (primary_user_id, name) SELECT id, $3 FROM new_user RETURNING id, primary_user_id
         )
         INSERT INTO account_memberships (account_id, user_id, role) SELECT id, primary_user_id, 'owner' FROM new_account
         RETURNING user_id, account_id`,
        [marker, `${marker}@example.test`, marker]
      );
      appUserId = seeded.rows[0].user_id;
      accountId = seeded.rows[0].account_id;
      const sites = createPostgresSitePersistenceRepository(database!.pool);
      const publications = createPostgresSitePublicationRepository(database!.pool);
      const reader = createPostgresPublishedSiteReader(database!.pool);
      const siteId = `${marker}-site`;
      const site = { id: siteId, username: `pub-${Date.now()}`, displayName: 'Published version one', bio: 'A complete bio', templateId: 'signature', links: [], revision: 1, isPublished: false };
      await sites.create(marker, siteId, site);

      const first = await publications.publish({ userId: marker, siteId, expectedDraftRevision: 1 });
      expect(first.status).toBe('published');
      expect(first.publicationVersion).toBe(1);
      expect((await reader.getPublishedSiteByHandle(site.username))?.displayName).toBe('Published version one');

      const current = await sites.getOwned(marker, siteId);
      const saved = await sites.saveVersioned({ userId: marker, siteId, site: { ...current!.data, displayName: 'Draft only' }, previousHandle: site.username, nextHandle: site.username, expectedRevision: 1 });
      expect(saved.status).toBe('saved');
      expect((await reader.getPublishedSiteByHandle(site.username))?.displayName).toBe('Published version one');

      const second = await publications.publish({ userId: marker, siteId, expectedDraftRevision: 2 });
      expect(second.publicationVersion).toBe(2);
      expect((await reader.getPublishedSiteByHandle(site.username))?.displayName).toBe('Draft only');

      const rolledBack = await publications.rollback({ userId: marker, siteId, publicationVersion: 1, expectedPublicationVersion: 2 });
      expect(rolledBack.status).toBe('rolled_back');
      expect(rolledBack.publicationVersion).toBe(3);
      expect((await reader.getPublishedSiteByHandle(site.username))?.displayName).toBe('Published version one');

      const unpublished = await publications.unpublish({ userId: marker, siteId, expectedPublicationVersion: 3 });
      expect(unpublished.status).toBe('unpublished');
      expect(await reader.getPublishedSiteByHandle(site.username)).toBeNull();

      const snapshots = await database!.pool.query('SELECT COUNT(*)::int AS count FROM published_site_snapshots WHERE site_id = (SELECT id FROM sites WHERE legacy_site_id = $1)', [siteId]);
      expect(snapshots.rows[0].count).toBe(3);
    } finally {
      if (accountId) {
        await database!.pool.query('ALTER TABLE audit_log DISABLE TRIGGER audit_log_append_only');
        try { await database!.pool.query('DELETE FROM audit_log WHERE site_id IN (SELECT id FROM sites WHERE account_id = $1)', [accountId]); }
        finally { await database!.pool.query('ALTER TABLE audit_log ENABLE TRIGGER audit_log_append_only'); }
      }
      if (accountId) await database!.pool.query('ALTER TABLE published_site_snapshots DISABLE TRIGGER published_site_snapshots_append_only');
      if (accountId) await database!.pool.query('DELETE FROM sites WHERE account_id = $1', [accountId]);
      if (accountId) await database!.pool.query('ALTER TABLE published_site_snapshots ENABLE TRIGGER published_site_snapshots_append_only');
      if (accountId) await database!.pool.query('DELETE FROM accounts WHERE id = $1', [accountId]);
      if (appUserId) await database!.pool.query('DELETE FROM app_users WHERE id = $1', [appUserId]);
    }
  });
});

if (!configured) console.info('PostgreSQL integration suite skipped: set POSTGRES_TEST_DATABASE_URL to run against an isolated database.');
