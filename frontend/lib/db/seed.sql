-- Ledgerline schema + seed (PostgreSQL / Aurora DSQL compatible)
-- Money is stored in integer cents. Run this once against your cluster.

CREATE TABLE IF NOT EXISTS customers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  plan                  text NOT NULL,
  spend_threshold_cents bigint NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     uuid NOT NULL,
  metric          text NOT NULL,
  quantity        numeric NOT NULL,
  event_time      timestamptz NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS usage_events_customer_time_idx
  ON usage_events (customer_id, event_time);

CREATE TABLE IF NOT EXISTS pricing (
  metric           text PRIMARY KEY,
  unit_price_cents bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  uuid NOT NULL,
  period_start timestamptz NOT NULL,
  period_end   timestamptz NOT NULL,
  total_cents  bigint NOT NULL,
  line_items   jsonb NOT NULL,
  status       text NOT NULL DEFAULT 'draft',
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Prevent duplicate invoices when the roll-up re-runs for the same period.
CREATE UNIQUE INDEX IF NOT EXISTS invoices_customer_period_idx
  ON invoices (customer_id, period_start, period_end);

-- ---------------------------------------------------------------------------
-- Seed: pricing rate card
-- ---------------------------------------------------------------------------
INSERT INTO pricing (metric, unit_price_cents) VALUES
  ('api_call', 2),
  ('gb_stored', 12),
  ('seat', 1500),
  ('compute_ms', 1),
  ('egress_gb', 9)
ON CONFLICT (metric) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Seed: 3 sample customers
-- ---------------------------------------------------------------------------
INSERT INTO customers (id, name, plan, spend_threshold_cents, created_at) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Northwind Logistics', 'Scale',   50000, now()),
  ('22222222-2222-4222-8222-222222222222', 'Helios Robotics',     'Growth',  25000, now()),
  ('33333333-3333-4333-8333-333333333333', 'Atlas Mapping Co.',   'Starter', 10000, now())
ON CONFLICT (id) DO NOTHING;
