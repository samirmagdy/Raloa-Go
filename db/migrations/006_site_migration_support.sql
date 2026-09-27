-- Site migration support: slug redirects and mutable current-pointer metadata.
-- compatibility: expand

BEGIN;

CREATE TABLE site_slug_redirects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  old_handle text NOT NULL,
  new_handle text NOT NULL,
  created_by uuid NOT NULL REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (old_handle),
  FOREIGN KEY (site_id, account_id) REFERENCES sites(id, account_id)
);
CREATE INDEX site_slug_redirects_site_idx ON site_slug_redirects (site_id, created_at DESC);
CREATE INDEX site_slug_redirects_target_idx ON site_slug_redirects (new_handle);

CREATE TRIGGER site_slug_redirects_updated_at
  BEFORE UPDATE ON site_slug_redirects FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Snapshot payloads are immutable. The current pointer may move from one
-- immutable snapshot to another during a publish transaction.
CREATE OR REPLACE FUNCTION reject_published_snapshot_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.id = OLD.id
    AND NEW.account_id = OLD.account_id
    AND NEW.site_id = OLD.site_id
    AND NEW.draft_id IS NOT DISTINCT FROM OLD.draft_id
    AND NEW.revision = OLD.revision
    AND NEW.content = OLD.content
    AND NEW.design_config = OLD.design_config
    AND NEW.content_hash = OLD.content_hash
    AND NEW.published_by = OLD.published_by
    AND NEW.is_current IS DISTINCT FROM OLD.is_current
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'published_site_snapshots are immutable';
END;
$$;

COMMIT;
