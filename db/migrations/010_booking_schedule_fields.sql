-- Relational booking schedule configuration and explicit blackout dates.
-- compatibility: expand

BEGIN;

ALTER TABLE booking_services
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS min_notice_minutes integer NOT NULL DEFAULT 0 CHECK (min_notice_minutes >= 0),
  ADD COLUMN IF NOT EXISTS booking_window_days integer NOT NULL DEFAULT 30 CHECK (booking_window_days > 0),
  ADD COLUMN IF NOT EXISTS max_bookings_per_day integer NOT NULL DEFAULT 10 CHECK (max_bookings_per_day > 0);

CREATE TABLE IF NOT EXISTS booking_blackout_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  blackout_date date NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, blackout_date)
);
CREATE INDEX IF NOT EXISTS booking_blackout_dates_site_date_idx
  ON booking_blackout_dates (site_id, blackout_date);

COMMIT;
