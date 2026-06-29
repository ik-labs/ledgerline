-- Ledgerline schema for Aurora DSQL (Postgres-compatible)
--
-- DSQL-specific notes baked into this DDL:
--   * NO FOREIGN KEYS — DSQL does not support them. customer_id is a plain uuid;
--     referential integrity is enforced in application code.
--   * Secondary / unique indexes must be created with CREATE INDEX ASYNC and live
--     outside the CREATE TABLE statement.
--   * One DDL statement per transaction — run each statement on its own (psql in
--     autocommit mode does this; do NOT wrap this file in BEGIN/COMMIT).
--   * gen_random_uuid(), now(), numeric, jsonb, timestamptz are all supported.

-- ----------------------------------------------------------------------------
-- customers
-- ----------------------------------------------------------------------------
CREATE TABLE customers (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name                  text NOT NULL,
    plan                  text NOT NULL,
    spend_threshold_cents bigint,
    created_at            timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- usage_events  (append-only — the meter)
--   No UPDATE/DELETE in app code. Corrections are new events.
--   The unique idempotency_key is what makes "never double-count" real.
-- ----------------------------------------------------------------------------
CREATE TABLE usage_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     uuid NOT NULL,
    metric          text NOT NULL,
    quantity        numeric NOT NULL,
    event_time      timestamptz NOT NULL,
    idempotency_key text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- "never double-count": a re-delivered SQS message inserts once.
CREATE UNIQUE INDEX ASYNC usage_events_idem_key
    ON usage_events (idempotency_key);

-- fast per-customer meter reads
CREATE INDEX ASYNC usage_events_customer_time
    ON usage_events (customer_id, event_time);

-- ----------------------------------------------------------------------------
-- pricing  (simple v1 rate card)
-- ----------------------------------------------------------------------------
CREATE TABLE pricing (
    metric           text PRIMARY KEY,
    unit_price_cents bigint NOT NULL
);

-- ----------------------------------------------------------------------------
-- invoices  (rolled-up cycles)
--   One invoice per (customer_id, period_start, period_end) — re-running the
--   roll-up must not create duplicates. This is the roll-up's "never double-count".
-- ----------------------------------------------------------------------------
CREATE TABLE invoices (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id  uuid NOT NULL,
    period_start timestamptz NOT NULL,
    period_end   timestamptz NOT NULL,
    total_cents  bigint NOT NULL,
    line_items   jsonb NOT NULL,
    status       text NOT NULL DEFAULT 'draft',
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ASYNC invoices_customer_period
    ON invoices (customer_id, period_start, period_end);
