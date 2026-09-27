-- Additive hardening for the transactional target schema.
-- compatibility: expand
-- This migration introduces account-level tenancy without forcing a data
-- backfill, then adds idempotency keys where aggregate commands need them.

BEGIN;

CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_user_id uuid NOT NULL REFERENCES app_users(id),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (primary_user_id, name)
);
CREATE INDEX accounts_primary_user_idx ON accounts (primary_user_id, created_at DESC);

CREATE TABLE account_memberships (
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, user_id)
);
CREATE INDEX account_memberships_user_idx ON account_memberships (user_id, account_id);

-- Nullable during strangler migration: existing sites continue to use
-- owner_user_id until account ownership is backfilled and made mandatory.
ALTER TABLE sites ADD COLUMN account_id uuid REFERENCES accounts(id) ON DELETE RESTRICT;
CREATE INDEX sites_account_updated_idx ON sites (account_id, updated_at DESC)
  WHERE account_id IS NOT NULL;

ALTER TABLE orders ADD COLUMN idempotency_key text;
CREATE UNIQUE INDEX orders_site_idempotency_idx
  ON orders (site_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX inventory_reservations_order_idempotency_idx
  ON inventory_reservations (order_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE integrations ADD COLUMN connection_idempotency_key text;
CREATE UNIQUE INDEX integrations_connection_idempotency_idx
  ON integrations (connection_idempotency_key)
  WHERE connection_idempotency_key IS NOT NULL;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['accounts', 'account_memberships'] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      table_name,
      table_name
    );
  END LOOP;
END;
$$;

COMMIT;
