-- Commerce authority, immutable prices, idempotency, and fulfillment audit.
-- compatibility: expand

BEGIN;

CREATE TABLE IF NOT EXISTS product_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES product_variants(id) ON DELETE CASCADE,
  currency char(3) NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  active boolean NOT NULL DEFAULT true,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);
CREATE INDEX IF NOT EXISTS product_prices_lookup_idx ON product_prices (product_id, variant_id, active, effective_from DESC);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS orders_site_idempotency_idx ON orders (site_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_site_created_cursor_idx ON orders (site_id, created_at DESC, id DESC);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_reservations_idempotency_idx
  ON inventory_reservations (variant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS fulfillment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  fulfillment_id uuid REFERENCES fulfillments(id) ON DELETE SET NULL,
  from_status fulfillment_state,
  to_status fulfillment_state NOT NULL,
  actor_user_id uuid REFERENCES app_users(id),
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS fulfillment_history_order_created_idx ON fulfillment_history (order_id, created_at DESC);

COMMIT;
