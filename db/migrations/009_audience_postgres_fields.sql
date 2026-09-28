-- Audience ownership, attribution, consent, and export metadata.
-- compatibility: expand

BEGIN;

ALTER TABLE audience_subscribers
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS consent_status text NOT NULL DEFAULT 'unknown'
    CHECK (consent_status IN ('unknown', 'granted', 'withdrawn')),
  ADD COLUMN IF NOT EXISTS consented_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_source text;

ALTER TABLE form_submissions
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'public_form',
  ADD COLUMN IF NOT EXISTS attribution jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(attribution) = 'object'),
  ADD COLUMN IF NOT EXISTS consent_status text NOT NULL DEFAULT 'unknown'
    CHECK (consent_status IN ('unknown', 'granted', 'withdrawn')),
  ADD COLUMN IF NOT EXISTS consented_at timestamptz;

CREATE INDEX IF NOT EXISTS audience_subscribers_site_tags_idx
  ON audience_subscribers USING gin (tags) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS form_submissions_site_status_created_idx
  ON form_submissions (site_id, status, created_at DESC);

COMMIT;
