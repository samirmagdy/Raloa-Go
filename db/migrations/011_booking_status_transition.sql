-- Server-side booking lifecycle guard. External calendar/email state is not
-- part of this transaction; booking state is authoritative here.
-- compatibility: expand

BEGIN;

CREATE OR REPLACE FUNCTION enforce_booking_status_transition() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NOT (
    (OLD.status = 'pending' AND NEW.status IN ('confirmed', 'cancelled')) OR
    (OLD.status = 'confirmed' AND NEW.status IN ('cancelled', 'completed', 'no_show'))
  ) THEN
    RAISE EXCEPTION 'invalid booking status transition: % -> %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_status_transition_guard ON bookings;
CREATE TRIGGER bookings_status_transition_guard
  BEFORE UPDATE OF status ON bookings
  FOR EACH ROW EXECUTE FUNCTION enforce_booking_status_transition();

COMMIT;
