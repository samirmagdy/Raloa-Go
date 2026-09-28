-- compatibility: expand
BEGIN;

ALTER TABLE outbox_events
  ADD COLUMN IF NOT EXISTS event_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS correlation_id text,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz;

CREATE INDEX IF NOT EXISTS outbox_events_correlation_idx
  ON outbox_events (correlation_id, created_at);
CREATE INDEX IF NOT EXISTS outbox_events_delivery_idx
  ON outbox_events (status, available_at, created_at);

CREATE TABLE IF NOT EXISTS outbox_event_consumers (
  event_id uuid NOT NULL REFERENCES outbox_events(id) ON DELETE CASCADE,
  consumer_key text NOT NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'processed', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, consumer_key)
);
CREATE INDEX IF NOT EXISTS outbox_event_consumers_status_idx
  ON outbox_event_consumers (status, updated_at);

COMMIT;
