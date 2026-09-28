-- Query-shape indexes for public delivery, media libraries, and operational cleanup.
-- compatibility: expand

BEGIN;

CREATE INDEX IF NOT EXISTS sites_public_snapshot_lookup_idx
  ON sites (handle, published_snapshot_id)
  WHERE is_published = true AND published_snapshot_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS custom_domains_public_lookup_idx
  ON custom_domains (hostname, site_id)
  WHERE verification_status = 'verified'
    AND ssl_status = 'active'
    AND provisioning_state = 'verified';

CREATE INDEX IF NOT EXISTS media_assets_site_state_created_idx
  ON media_assets (site_id, lifecycle_state, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS media_variants_asset_kind_idx
  ON media_variants (asset_id, kind);

CREATE INDEX IF NOT EXISTS booking_slots_service_start_status_idx
  ON booking_slots (service_id, starts_at, status);

CREATE INDEX IF NOT EXISTS analytics_daily_site_day_idx
  ON analytics_daily_rollups (site_id, day DESC);

COMMIT;
