-- RALOA PostgreSQL target schema.
-- Additive only: this migration does not modify Firestore or Firebase Auth.
-- Firebase UID is retained in app_users.external_auth_id during the migration.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
CREATE TYPE booking_slot_status AS ENUM ('available', 'held', 'booked', 'blocked');
CREATE TYPE attendee_role AS ENUM ('host', 'customer', 'additional');
CREATE TYPE calendar_sync_status AS ENUM ('pending', 'synced', 'cancelled', 'failed');
CREATE TYPE reservation_status AS ENUM ('active', 'expired', 'released', 'consumed');
CREATE TYPE payment_status AS ENUM ('pending', 'authorized', 'paid', 'failed', 'refunded', 'partially_refunded');
CREATE TYPE fulfillment_state AS ENUM ('unfulfilled', 'processing', 'fulfilled', 'cancelled', 'returned');
CREATE TYPE inventory_movement_type AS ENUM ('receipt', 'adjustment', 'reservation', 'reservation_release', 'sale', 'return', 'correction');
CREATE TYPE order_status AS ENUM ('pending_payment', 'paid', 'payment_failed', 'cancelled', 'refunded');
CREATE TYPE order_state AS ENUM ('pending', 'paid', 'processing', 'fulfilled', 'cancelled', 'refunded', 'payment_failed');
CREATE TYPE fulfillment_status AS ENUM ('unfulfilled', 'processing', 'fulfilled', 'cancelled');
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'cancelled', 'incomplete', 'paused');
CREATE TYPE integration_status AS ENUM ('connected', 'disconnected', 'error');
CREATE TYPE idempotency_status AS ENUM ('processing', 'completed', 'failed');
CREATE TYPE entitlement_state AS ENUM ('free', 'trial', 'active', 'grace_period', 'past_due', 'cancellation_scheduled', 'subscription_ending', 'pending', 'failed_payment', 'canceled');
CREATE TYPE webhook_processing_status AS ENUM ('received', 'processing', 'processed', 'failed');

CREATE TABLE app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_auth_id text NOT NULL UNIQUE,
  email text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES app_users(id),
  handle text NOT NULL UNIQUE CHECK (handle ~ '^[a-z0-9_-]{3,30}$'),
  display_name text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sites_content_object CHECK (jsonb_typeof(content) = 'object')
);
CREATE INDEX sites_owner_updated_idx ON sites (owner_user_id, updated_at DESC);
CREATE INDEX sites_published_handle_idx ON sites (handle) WHERE is_published;

CREATE TABLE booking_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9_-]{1,64}$'),
  name text NOT NULL,
  description text,
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 15 AND 480),
  buffer_minutes integer NOT NULL DEFAULT 0 CHECK (buffer_minutes BETWEEN 0 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, slug),
  UNIQUE (id, site_id)
);

CREATE TABLE availability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  timezone text NOT NULL,
  CHECK (starts_at < ends_at)
);
CREATE INDEX availability_rules_site_weekday_idx ON availability_rules (site_id, weekday, starts_at);

CREATE TABLE availability_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text,
  CHECK (starts_at < ends_at)
);
CREATE INDEX availability_exceptions_site_time_idx ON availability_exceptions (site_id, starts_at, ends_at);

-- Materialized availability. Slots are generated from rules/exceptions by a
-- scheduler and are the row a booking transaction locks and claims.
CREATE TABLE booking_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  service_id uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL,
  status booking_slot_status NOT NULL DEFAULT 'available',
  capacity integer NOT NULL DEFAULT 1 CHECK (capacity > 0),
  booked_count integer NOT NULL DEFAULT 0 CHECK (booked_count BETWEEN 0 AND capacity),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at < ends_at),
  UNIQUE (site_id, service_id, starts_at, ends_at),
  FOREIGN KEY (service_id, site_id) REFERENCES booking_services(id, site_id) ON DELETE CASCADE
);
CREATE INDEX booking_slots_available_idx ON booking_slots (site_id, service_id, starts_at)
  WHERE status = 'available';
CREATE INDEX booking_slots_time_idx ON booking_slots (site_id, starts_at, ends_at);

CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id),
  host_user_id uuid NOT NULL REFERENCES app_users(id),
  service_id uuid NOT NULL,
  slot_id uuid REFERENCES booking_slots(id),
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL,
  status booking_status NOT NULL DEFAULT 'pending',
  external_event_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at < ends_at),
  FOREIGN KEY (service_id, site_id) REFERENCES booking_services(id, site_id)
);
CREATE INDEX bookings_host_created_idx ON bookings (host_user_id, created_at DESC, id DESC);
CREATE INDEX bookings_site_time_idx ON bookings (site_id, starts_at, ends_at);
CREATE INDEX bookings_customer_email_idx ON bookings (customer_email, created_at DESC);
-- One active booking per one-on-one slot. Group services use capacity and are
-- checked while locking the slot row in the booking transaction.
CREATE UNIQUE INDEX bookings_active_slot_idx ON bookings (slot_id)
  WHERE slot_id IS NOT NULL AND status IN ('pending', 'confirmed');
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    site_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status IN ('pending', 'confirmed'));

CREATE TABLE booking_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  role attendee_role NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  response_status text NOT NULL DEFAULT 'pending'
    CHECK (response_status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, role, email)
);
CREATE INDEX booking_attendees_email_idx ON booking_attendees (email, created_at DESC);

CREATE TABLE calendar_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_users(id),
  provider text NOT NULL CHECK (provider IN ('google', 'outlook')),
  external_event_id text,
  status calendar_sync_status NOT NULL DEFAULT 'pending',
  last_attempt_at timestamptz,
  synced_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_event_id)
);
CREATE INDEX calendar_sync_pending_idx ON calendar_sync_state (status, last_attempt_at)
  WHERE status IN ('pending', 'failed');

CREATE TABLE booking_idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id),
  requester_user_id uuid REFERENCES app_users(id),
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  booking_id uuid REFERENCES bookings(id),
  response_status integer,
  response_body jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, idempotency_key)
);
CREATE INDEX booking_idempotency_expiry_idx ON booking_idempotency_keys (expires_at);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  creator_user_id uuid NOT NULL REFERENCES app_users(id),
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  currency char(3) NOT NULL CHECK (currency IN ('USD', 'EUR', 'GBP', 'SAR', 'AED', 'CAD', 'AUD')),
  price_minor bigint NOT NULL CHECK (price_minor >= 50),
  active boolean NOT NULL DEFAULT true,
  provider_product_id text,
  provider_price_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, slug),
  UNIQUE (provider_product_id),
  UNIQUE (provider_price_id)
);
CREATE INDEX products_creator_active_idx ON products (creator_user_id, active, created_at DESC);

CREATE TABLE product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku text NOT NULL UNIQUE,
  name text NOT NULL,
  option_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  price_minor bigint,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(option_values) = 'object'),
  CHECK (price_minor IS NULL OR price_minor >= 50),
  UNIQUE (product_id, name)
);
CREATE INDEX product_variants_product_active_idx ON product_variants (product_id, active);

CREATE TABLE inventory (
  variant_id uuid PRIMARY KEY REFERENCES product_variants(id) ON DELETE CASCADE,
  on_hand integer CHECK (on_hand IS NULL OR on_hand >= 0),
  reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (on_hand IS NULL OR reserved <= on_hand)
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id uuid NOT NULL REFERENCES app_users(id),
  site_id uuid NOT NULL REFERENCES sites(id),
  customer_email text NOT NULL,
  status order_status NOT NULL DEFAULT 'pending_payment',
  state order_state NOT NULL DEFAULT 'pending',
  fulfillment_status fulfillment_status NOT NULL DEFAULT 'unfulfilled',
  provider_checkout_id text UNIQUE,
  total_minor bigint NOT NULL CHECK (total_minor >= 0),
  currency char(3) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_creator_created_idx ON orders (creator_user_id, created_at DESC, id DESC);
CREATE INDEX orders_customer_created_idx ON orders (customer_email, created_at DESC);

CREATE TABLE order_state_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_state order_state,
  to_state order_state NOT NULL,
  source text NOT NULL CHECK (source IN ('api', 'stripe_webhook', 'worker', 'migration')),
  actor_user_id uuid REFERENCES app_users(id),
  transition_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, transition_key)
);
CREATE INDEX order_state_history_order_idx ON order_state_history (order_id, created_at DESC);

CREATE OR REPLACE FUNCTION enforce_order_state_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.state = OLD.state THEN RETURN NEW; END IF;
  IF NOT (
    (OLD.state = 'pending' AND NEW.state IN ('paid', 'payment_failed', 'cancelled')) OR
    (OLD.state = 'payment_failed' AND NEW.state IN ('pending', 'cancelled')) OR
    (OLD.state = 'paid' AND NEW.state IN ('processing', 'cancelled', 'refunded')) OR
    (OLD.state = 'processing' AND NEW.state IN ('fulfilled', 'cancelled', 'refunded')) OR
    (OLD.state = 'fulfilled' AND NEW.state = 'refunded')
  ) THEN
    RAISE EXCEPTION 'invalid order state transition: % -> %', OLD.state, NEW.state;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER orders_state_transition_guard
  BEFORE UPDATE OF state ON orders
  FOR EACH ROW EXECUTE FUNCTION enforce_order_state_transition();

CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  variant_id uuid REFERENCES product_variants(id),
  product_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_minor bigint NOT NULL CHECK (unit_price_minor >= 0),
  total_minor bigint NOT NULL CHECK (total_minor = quantity * unit_price_minor),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_items_order_idx ON order_items (order_id);

CREATE TABLE inventory_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id),
  variant_id uuid REFERENCES product_variants(id),
  order_id uuid NOT NULL REFERENCES orders(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  status reservation_status NOT NULL DEFAULT 'active',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  idempotency_key text,
  released_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (released_at IS NULL OR consumed_at IS NULL),
  UNIQUE (product_id, order_id)
);
CREATE INDEX inventory_reservations_open_idx ON inventory_reservations (product_id) WHERE released_at IS NULL AND consumed_at IS NULL;
CREATE UNIQUE INDEX inventory_reservations_variant_order_idx ON inventory_reservations (variant_id, order_id)
  WHERE variant_id IS NOT NULL;
CREATE INDEX inventory_reservations_expiry_idx ON inventory_reservations (expires_at)
  WHERE status = 'active';

CREATE TABLE inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES product_variants(id),
  order_id uuid REFERENCES orders(id),
  reservation_id uuid REFERENCES inventory_reservations(id),
  movement_type inventory_movement_type NOT NULL,
  quantity_delta integer NOT NULL CHECK (quantity_delta <> 0),
  on_hand_after integer NOT NULL CHECK (on_hand_after >= 0),
  reserved_after integer NOT NULL CHECK (reserved_after >= 0),
  idempotency_key text NOT NULL UNIQUE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inventory_movements_variant_time_idx ON inventory_movements (variant_id, created_at DESC);
CREATE INDEX inventory_movements_order_idx ON inventory_movements (order_id, created_at);

CREATE OR REPLACE FUNCTION reject_inventory_movement_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'inventory_movements is append-only';
END;
$$;
CREATE TRIGGER inventory_movements_append_only
  BEFORE UPDATE OR DELETE ON inventory_movements
  FOR EACH ROW EXECUTE FUNCTION reject_inventory_movement_mutation();

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  provider text NOT NULL DEFAULT 'stripe',
  provider_payment_id text,
  provider_event_id text,
  status payment_status NOT NULL DEFAULT 'pending',
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency char(3) NOT NULL,
  idempotency_key text NOT NULL,
  raw_event jsonb,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_payment_id),
  UNIQUE (provider, provider_event_id),
  UNIQUE (provider, idempotency_key)
);
CREATE INDEX payments_order_idx ON payments (order_id, created_at DESC);

CREATE TABLE payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  payment_id uuid REFERENCES payments(id),
  payload jsonb NOT NULL,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);
CREATE INDEX payment_events_unprocessed_idx ON payment_events (created_at)
  WHERE processed_at IS NULL;

CREATE TABLE fulfillments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  status fulfillment_state NOT NULL DEFAULT 'unfulfilled',
  tracking_number text,
  carrier text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE billing_price_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'stripe',
  plan text NOT NULL CHECK (plan IN ('pro', 'studio')),
  billing_interval text NOT NULL CHECK (billing_interval IN ('monthly', 'yearly')),
  provider_product_id text,
  provider_price_id text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_price_id),
  UNIQUE (provider, plan, billing_interval)
);

CREATE TABLE billing_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES app_users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'stripe',
  provider_customer_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_customer_id)
);

CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id),
  provider text NOT NULL DEFAULT 'stripe',
  provider_customer_id text,
  provider_subscription_id text,
  price_mapping_id uuid REFERENCES billing_price_mappings(id),
  provider_price_id text,
  plan text NOT NULL CHECK (plan IN ('free', 'pro', 'studio')),
  status subscription_status NOT NULL,
  entitlement_state entitlement_state NOT NULL DEFAULT 'free',
  interval text CHECK (interval IN ('monthly', 'yearly')),
  current_period_end timestamptz,
  trial_end timestamptz,
  cancel_at timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  renewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider),
  UNIQUE (provider, provider_subscription_id),
  UNIQUE (provider, provider_customer_id)
);
CREATE INDEX subscriptions_status_idx ON subscriptions (status, current_period_end);
CREATE INDEX subscriptions_reconciliation_idx ON subscriptions (provider, updated_at)
  WHERE provider_subscription_id IS NOT NULL;

CREATE TABLE subscription_state_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  previous_state entitlement_state,
  next_state entitlement_state NOT NULL,
  provider_event_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscription_state_history_subscription_idx ON subscription_state_history (subscription_id, created_at DESC);

CREATE TABLE billing_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'stripe',
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  status webhook_processing_status NOT NULL DEFAULT 'received',
  payload jsonb,
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);
CREATE INDEX billing_webhook_events_retry_idx ON billing_webhook_events (status, received_at)
  WHERE status IN ('received', 'failed');

CREATE TABLE billing_reconciliation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'stripe',
  user_id uuid REFERENCES app_users(id),
  provider_customer_id text,
  provider_subscription_id text,
  status text NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  observed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX billing_reconciliation_due_idx ON billing_reconciliation_runs (provider, created_at)
  WHERE status IN ('started', 'failed');

CREATE TABLE integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status integration_status NOT NULL DEFAULT 'disconnected',
  connection_state text NOT NULL DEFAULT 'connected'
    CHECK (connection_state IN ('connected', 'refreshing', 'reauthorization_required', 'revoked', 'error')),
  scopes text[] NOT NULL DEFAULT '{}',
  encrypted_credentials bytea,
  encrypted_access_token bytea,
  encrypted_refresh_token bytea,
  token_expires_at timestamptz,
  refresh_lock_until timestamptz,
  token_version integer NOT NULL DEFAULT 1 CHECK (token_version > 0),
  revoked_at timestamptz,
  expires_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, site_id)
);
CREATE INDEX integrations_provider_status_idx ON integrations (provider, status);
CREATE UNIQUE INDEX integrations_user_provider_global_uniq
  ON integrations (user_id, provider) WHERE site_id IS NULL;
CREATE UNIQUE INDEX integrations_user_provider_site_uniq
  ON integrations (user_id, provider, site_id) WHERE site_id IS NOT NULL;
CREATE INDEX integrations_refresh_due_idx ON integrations (refresh_lock_until, token_expires_at)
  WHERE connection_state IN ('connected', 'refreshing');

CREATE TABLE custom_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  hostname text NOT NULL,
  verification_status text NOT NULL CHECK (verification_status IN ('pending', 'verified', 'failed')),
  ssl_status text NOT NULL CHECK (ssl_status IN ('pending', 'active', 'failed')),
  provider_hostname_id text,
  verification_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hostname),
  UNIQUE (site_id)
);
CREATE INDEX custom_domains_ready_idx ON custom_domains (hostname) WHERE verification_status = 'verified' AND ssl_status = 'active';

CREATE TABLE analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id),
  site_owner_id uuid REFERENCES app_users(id),
  event_type text NOT NULL CHECK (event_type IN ('page_view', 'link_click')),
  occurred_at timestamptz NOT NULL,
  visitor_hash text,
  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX analytics_events_site_time_idx ON analytics_events (site_id, occurred_at);
CREATE INDEX analytics_events_owner_time_idx ON analytics_events (site_owner_id, occurred_at);

CREATE TABLE analytics_daily_rollups (
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  site_owner_id uuid NOT NULL REFERENCES app_users(id),
  day date NOT NULL,
  page_views bigint NOT NULL DEFAULT 0 CHECK (page_views >= 0),
  link_clicks bigint NOT NULL DEFAULT 0 CHECK (link_clicks >= 0),
  unique_visitors bigint NOT NULL DEFAULT 0 CHECK (unique_visitors >= 0),
  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, day)
);
CREATE INDEX analytics_rollups_owner_day_idx ON analytics_daily_rollups (site_owner_id, day);

CREATE TABLE analytics_visitor_days (
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  site_owner_id uuid NOT NULL REFERENCES app_users(id),
  day date NOT NULL,
  visitor_hash text NOT NULL,
  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, day, visitor_hash)
);

CREATE TABLE idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES app_users(id),
  scope text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  status idempotency_status NOT NULL DEFAULT 'processing',
  response_status integer,
  response_body jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, idempotency_key)
);
CREATE INDEX idempotency_expiry_idx ON idempotency_keys (expires_at);

CREATE TABLE operational_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('notification', 'calendar', 'media_cleanup', 'billing_reconciliation')),
  aggregate_type text,
  aggregate_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'retry', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX operational_jobs_claim_idx ON operational_jobs (status, available_at, created_at);

CREATE TABLE audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid REFERENCES app_users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_entity_idx ON audit_log (entity_type, entity_id, created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['app_users', 'sites', 'booking_services', 'booking_slots', 'bookings', 'booking_attendees', 'calendar_sync_state', 'booking_idempotency_keys', 'products', 'product_variants', 'inventory', 'orders', 'order_items', 'inventory_reservations', 'payments', 'fulfillments', 'billing_price_mappings', 'billing_customers', 'subscriptions', 'billing_webhook_events', 'billing_reconciliation_runs', 'integrations', 'custom_domains', 'analytics_daily_rollups', 'idempotency_keys', 'operational_jobs'] LOOP
    EXECUTE format('CREATE TRIGGER %I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', table_name, table_name);
  END LOOP;
END;
$$;

COMMIT;
