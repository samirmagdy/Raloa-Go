-- compatibility: expand
BEGIN;
-- Analytics v2: idempotent events and bounded operational rollups.
-- Raw events are a short-lived PostgreSQL buffer; analytical retention belongs
-- behind the AnalyticsRawEventStore port (for example, BigQuery).
ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS event_id text;
CREATE UNIQUE INDEX IF NOT EXISTS analytics_events_site_event_id_uidx
  ON analytics_events(site_id, event_id) WHERE event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS analytics_dimension_daily_rollups (
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  site_owner_id uuid NOT NULL REFERENCES app_users(id),
  day date NOT NULL,
  dimension text NOT NULL CHECK (dimension IN ('referrer', 'device', 'browser', 'country')),
  dimension_value text NOT NULL,
  page_views bigint NOT NULL DEFAULT 0 CHECK (page_views >= 0),
  clicks bigint NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  unique_visitors bigint NOT NULL DEFAULT 0 CHECK (unique_visitors >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, day, dimension, dimension_value),
  FOREIGN KEY (site_id, site_owner_id) REFERENCES sites(id, owner_user_id)
);
CREATE INDEX IF NOT EXISTS analytics_dimension_owner_day_idx
  ON analytics_dimension_daily_rollups(site_owner_id, day, dimension, dimension_value);

CREATE TABLE IF NOT EXISTS analytics_link_daily_rollups (
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  site_owner_id uuid NOT NULL REFERENCES app_users(id),
  day date NOT NULL,
  link_id text NOT NULL,
  page_views bigint NOT NULL DEFAULT 0 CHECK (page_views >= 0),
  clicks bigint NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  unique_visitors bigint NOT NULL DEFAULT 0 CHECK (unique_visitors >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, day, link_id),
  FOREIGN KEY (site_id, site_owner_id) REFERENCES sites(id, owner_user_id)
);
CREATE INDEX IF NOT EXISTS analytics_link_owner_day_idx
  ON analytics_link_daily_rollups(site_owner_id, day, clicks DESC);

CREATE TABLE IF NOT EXISTS analytics_utm_daily_rollups (
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  site_owner_id uuid NOT NULL REFERENCES app_users(id),
  day date NOT NULL,
  source text NOT NULL DEFAULT '(direct)',
  medium text NOT NULL DEFAULT '(none)',
  campaign text NOT NULL DEFAULT '(none)',
  term text NOT NULL DEFAULT '(none)',
  content text NOT NULL DEFAULT '(none)',
  page_views bigint NOT NULL DEFAULT 0 CHECK (page_views >= 0),
  clicks bigint NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  unique_visitors bigint NOT NULL DEFAULT 0 CHECK (unique_visitors >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, day, source, medium, campaign, term, content),
  FOREIGN KEY (site_id, site_owner_id) REFERENCES sites(id, owner_user_id)
);
CREATE INDEX IF NOT EXISTS analytics_utm_owner_day_idx
  ON analytics_utm_daily_rollups(site_owner_id, day, source, medium, campaign);

CREATE INDEX IF NOT EXISTS analytics_visitor_days_owner_day_idx
  ON analytics_visitor_days(site_owner_id, day, site_id);
COMMIT;
