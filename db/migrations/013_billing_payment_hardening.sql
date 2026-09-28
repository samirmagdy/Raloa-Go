-- compatibility: expand
-- Billing/payment hardening. Existing target-schema tables already provide the
-- provider ledger and idempotency keys; this migration adds operational fields
-- needed for bounded retries without changing existing API behavior.
BEGIN;

ALTER TABLE billing_webhook_events
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text;

CREATE INDEX IF NOT EXISTS billing_webhook_events_provider_status_idx
  ON billing_webhook_events (provider, status, received_at);

CREATE INDEX IF NOT EXISTS billing_customers_provider_customer_idx
  ON billing_customers (provider, provider_customer_id);

CREATE INDEX IF NOT EXISTS subscriptions_provider_customer_idx
  ON subscriptions (provider, provider_customer_id);

COMMIT;
