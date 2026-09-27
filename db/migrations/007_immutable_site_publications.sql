-- Immutable publication lifecycle for sites.
-- Draft saves update sites.content and site_drafts only. Public reads use the
-- current immutable snapshot selected by sites.published_snapshot_id.
-- compatibility: expand

BEGIN;

ALTER TABLE published_site_snapshots
  ADD COLUMN publication_version bigint;

UPDATE published_site_snapshots
   SET publication_version = revision
 WHERE publication_version IS NULL;

ALTER TABLE published_site_snapshots
  ALTER COLUMN publication_version SET NOT NULL,
  ADD CONSTRAINT published_snapshot_publication_version_positive CHECK (publication_version > 0),
  ADD CONSTRAINT published_snapshot_id_site_key UNIQUE (id, site_id),
  ADD CONSTRAINT published_snapshot_site_publication_version_unique UNIQUE (site_id, publication_version);

ALTER TABLE sites
  ADD COLUMN draft_revision bigint NOT NULL DEFAULT 0,
  ADD COLUMN publication_version bigint NOT NULL DEFAULT 0,
  ADD COLUMN published_snapshot_id uuid,
  ADD CONSTRAINT sites_draft_revision_nonnegative CHECK (draft_revision >= 0),
  ADD CONSTRAINT sites_publication_version_nonnegative CHECK (publication_version >= 0),
  ADD CONSTRAINT sites_published_snapshot_fk
    FOREIGN KEY (published_snapshot_id, id)
    REFERENCES published_site_snapshots (id, site_id);

UPDATE sites
   SET draft_revision = CASE
         WHEN content ->> 'revision' ~ '^[0-9]+$' THEN (content ->> 'revision')::bigint
         ELSE 0
       END,
       publication_version = COALESCE((
         SELECT MAX(snap.publication_version)
           FROM published_site_snapshots snap
          WHERE snap.site_id = sites.id AND snap.is_current
       ), 0),
       published_snapshot_id = (
         SELECT snap.id
           FROM published_site_snapshots snap
          WHERE snap.site_id = sites.id AND snap.is_current
          ORDER BY snap.publication_version DESC
          LIMIT 1
       );

CREATE INDEX sites_published_snapshot_idx ON sites (published_snapshot_id) WHERE published_snapshot_id IS NOT NULL;
CREATE INDEX published_snapshots_publication_version_idx ON published_site_snapshots (site_id, publication_version DESC);

COMMIT;
