-- Booking migration identity and compatibility data.
-- compatibility: expand

BEGIN;

-- Firestore document IDs are not guaranteed to be UUIDs. Keep the public
-- identifier stable while PostgreSQL uses UUID primary keys and foreign keys.
CREATE TABLE booking_id_map (
  legacy_booking_id text PRIMARY KEY,
  booking_id uuid NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  migrated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bookings ADD COLUMN legacy_payload jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE booking_services ADD COLUMN legacy_service_id text;
ALTER TABLE sites ADD COLUMN legacy_site_id text;
CREATE UNIQUE INDEX booking_services_legacy_service_idx
  ON booking_services (site_id, legacy_service_id)
  WHERE legacy_service_id IS NOT NULL;
CREATE UNIQUE INDEX sites_legacy_site_idx ON sites (legacy_site_id) WHERE legacy_site_id IS NOT NULL;

CREATE INDEX booking_id_map_booking_idx ON booking_id_map (booking_id);
CREATE INDEX bookings_legacy_payload_idx ON bookings USING gin (legacy_payload);

COMMIT;
