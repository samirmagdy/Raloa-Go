-- Commerce migration identity and compatibility fields.
-- compatibility: expand

BEGIN;

ALTER TABLE products ADD COLUMN legacy_product_id text;
ALTER TABLE products ADD COLUMN legacy_payload jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE orders ADD COLUMN legacy_order_id text;
ALTER TABLE orders ADD COLUMN legacy_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX products_legacy_product_idx ON products (legacy_product_id)
  WHERE legacy_product_id IS NOT NULL;
CREATE UNIQUE INDEX orders_legacy_order_idx ON orders (legacy_order_id)
  WHERE legacy_order_id IS NOT NULL;
CREATE INDEX orders_state_created_idx ON orders (state, created_at DESC);
CREATE INDEX orders_site_status_idx ON orders (site_id, status, created_at DESC);

COMMIT;
