-- A draft revision may be published more than once (republish or rollback).
-- publication_version is the immutable publication identity.
-- compatibility: expand

BEGIN;
ALTER TABLE published_site_snapshots DROP CONSTRAINT IF EXISTS published_site_snapshots_site_id_revision_key;
CREATE INDEX published_snapshots_site_revision_idx ON published_site_snapshots (site_id, revision);
COMMIT;
