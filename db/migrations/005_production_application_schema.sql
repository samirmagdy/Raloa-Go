-- Production application schema completion.
-- compatibility: expand
-- Adds versioned site content, audience, fulfillment history, OAuth credentials,
-- general webhook/event ledgers, and persisted feature flags. Existing tables
-- remain intact for dual-read/dual-write migration.

BEGIN;

-- Account/site ownership becomes explicit for new relational aggregates. The
-- nullable account_id on legacy sites remains nullable until backfill completes.
ALTER TABLE sites ADD CONSTRAINT sites_id_account_key UNIQUE (id, account_id);

CREATE TABLE site_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  revision bigint NOT NULL CHECK (revision > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'archived')),
  content jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(content) = 'object'),
  design_config jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(design_config) = 'object'),
  created_by uuid NOT NULL REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, revision),
  UNIQUE (id, site_id, account_id),
  FOREIGN KEY (site_id, account_id) REFERENCES sites(id, account_id)
);
CREATE INDEX site_drafts_site_status_idx ON site_drafts (site_id, status, updated_at DESC);
CREATE INDEX site_drafts_account_updated_idx ON site_drafts (account_id, updated_at DESC);

CREATE TABLE published_site_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  draft_id uuid REFERENCES site_drafts(id) ON DELETE RESTRICT,
  revision bigint NOT NULL CHECK (revision > 0),
  content jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(content) = 'object'),
  design_config jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(design_config) = 'object'),
  content_hash text NOT NULL,
  published_by uuid NOT NULL REFERENCES app_users(id),
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, revision),
  UNIQUE (id, site_id, account_id),
  FOREIGN KEY (site_id, account_id) REFERENCES sites(id, account_id),
  FOREIGN KEY (draft_id, site_id, account_id) REFERENCES site_drafts(id, site_id, account_id)
);
CREATE UNIQUE INDEX published_snapshots_current_idx ON published_site_snapshots (site_id) WHERE is_current;
CREATE INDEX published_snapshots_site_published_idx ON published_site_snapshots (site_id, created_at DESC);
CREATE INDEX published_snapshots_account_published_idx ON published_site_snapshots (account_id, created_at DESC);

CREATE TABLE site_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  draft_id uuid,
  snapshot_id uuid,
  block_key text NOT NULL CHECK (length(block_key) BETWEEN 1 AND 160),
  block_type text NOT NULL CHECK (length(block_type) BETWEEN 1 AND 80),
  position integer NOT NULL CHECK (position >= 0),
  config jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(config) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((draft_id IS NOT NULL) <> (snapshot_id IS NOT NULL)),
  FOREIGN KEY (draft_id, site_id, account_id) REFERENCES site_drafts(id, site_id, account_id) ON DELETE CASCADE,
  FOREIGN KEY (snapshot_id, site_id, account_id) REFERENCES published_site_snapshots(id, site_id, account_id) ON DELETE CASCADE,
  UNIQUE (draft_id, position),
  UNIQUE (snapshot_id, position),
  UNIQUE (draft_id, block_key),
  UNIQUE (snapshot_id, block_key)
);
CREATE INDEX site_blocks_draft_position_idx ON site_blocks (draft_id, position) WHERE draft_id IS NOT NULL;
CREATE INDEX site_blocks_snapshot_position_idx ON site_blocks (snapshot_id, position) WHERE snapshot_id IS NOT NULL;

CREATE TABLE audience_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  email text NOT NULL,
  email_normalized text NOT NULL,
  name text,
  status text NOT NULL DEFAULT 'subscribed' CHECK (status IN ('subscribed', 'unsubscribed', 'bounced', 'complained')),
  source text NOT NULL DEFAULT 'form',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  unsubscribed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, site_id, account_id),
  FOREIGN KEY (site_id, account_id) REFERENCES sites(id, account_id)
);
CREATE UNIQUE INDEX audience_subscribers_site_email_idx ON audience_subscribers (site_id, email_normalized) WHERE deleted_at IS NULL;
CREATE INDEX audience_subscribers_site_status_idx ON audience_subscribers (site_id, status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX audience_subscribers_account_created_idx ON audience_subscribers (account_id, created_at DESC);

CREATE TABLE form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  form_key text NOT NULL CHECK (length(form_key) BETWEEN 1 AND 160),
  submitter_email text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'spam', 'archived')),
  idempotency_key text NOT NULL,
  processed_at timestamptz,
  retention_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, idempotency_key),
  FOREIGN KEY (site_id, account_id) REFERENCES sites(id, account_id)
);
CREATE INDEX form_submissions_site_created_idx ON form_submissions (site_id, created_at DESC);
CREATE INDEX form_submissions_processing_idx ON form_submissions (status, created_at) WHERE status = 'received';
CREATE INDEX form_submissions_retention_idx ON form_submissions (retention_until);

CREATE TABLE fulfillment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  fulfillment_id uuid NOT NULL REFERENCES fulfillments(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  previous_status fulfillment_state,
  next_status fulfillment_state NOT NULL,
  actor_user_id uuid REFERENCES app_users(id),
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fulfillment_id, idempotency_key),
  FOREIGN KEY (site_id, account_id) REFERENCES sites(id, account_id)
);
CREATE INDEX fulfillment_history_order_idx ON fulfillment_history (order_id, created_at DESC);
CREATE INDEX fulfillment_history_account_created_idx ON fulfillment_history (account_id, created_at DESC);

CREATE TABLE oauth_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES integrations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  connection_state text NOT NULL DEFAULT 'connected' CHECK (connection_state IN ('connected', 'refreshing', 'reauthorization_required', 'revoked', 'error')),
  scopes text[] NOT NULL DEFAULT '{}',
  encrypted_access_token bytea,
  encrypted_refresh_token bytea,
  encryption_key_version integer NOT NULL DEFAULT 1 CHECK (encryption_key_version > 0),
  access_token_expires_at timestamptz,
  refresh_lock_until timestamptz,
  revoked_at timestamptz,
  last_error text,
  connect_idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, provider, site_id),
  UNIQUE (connect_idempotency_key),
  FOREIGN KEY (site_id, account_id) REFERENCES sites(id, account_id)
);
CREATE INDEX oauth_connections_refresh_idx ON oauth_connections (connection_state, refresh_lock_until, access_token_expires_at);
CREATE INDEX oauth_connections_account_idx ON oauth_connections (account_id, provider, updated_at DESC);

CREATE TABLE webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  status webhook_processing_status NOT NULL DEFAULT 'received',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);
CREATE INDEX webhook_events_retry_idx ON webhook_events (status, received_at) WHERE status IN ('received', 'failed');
CREATE INDEX webhook_events_type_idx ON webhook_events (provider, event_type, received_at DESC);

CREATE TABLE feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE,
  flag_key text NOT NULL CHECK (flag_key ~ '^[a-z][a-z0-9_.-]{1,120}$'),
  enabled boolean NOT NULL DEFAULT false,
  rollout_percentage smallint NOT NULL DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
  config jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(config) = 'object'),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (account_id IS NOT NULL OR site_id IS NOT NULL),
  CHECK (site_id IS NULL OR account_id IS NOT NULL)
);
CREATE UNIQUE INDEX feature_flags_account_key_idx ON feature_flags (account_id, flag_key)
  WHERE account_id IS NOT NULL AND site_id IS NULL;
CREATE UNIQUE INDEX feature_flags_site_key_idx ON feature_flags (site_id, flag_key)
  WHERE site_id IS NOT NULL;
CREATE INDEX feature_flags_account_idx ON feature_flags (account_id, flag_key) WHERE account_id IS NOT NULL;
CREATE INDEX feature_flags_site_idx ON feature_flags (site_id, flag_key) WHERE site_id IS NOT NULL;
CREATE INDEX feature_flags_expiry_idx ON feature_flags (expires_at) WHERE expires_at IS NOT NULL;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'site_drafts', 'published_site_snapshots', 'site_blocks',
    'audience_subscribers', 'form_submissions', 'fulfillment_history',
    'oauth_connections', 'webhook_events', 'feature_flags'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      table_name,
      table_name
    );
  END LOOP;
END;
$$;

-- Published snapshots, snapshot blocks, fulfillment history, webhook events,
-- and audit records are append-only from the application perspective.
CREATE OR REPLACE FUNCTION reject_published_snapshot_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'published_site_snapshots are immutable';
END;
$$;
CREATE TRIGGER published_site_snapshots_append_only
  BEFORE UPDATE OR DELETE ON published_site_snapshots
  FOR EACH ROW EXECUTE FUNCTION reject_published_snapshot_mutation();

COMMIT;
