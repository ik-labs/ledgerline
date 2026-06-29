-- Ledgerline seed data: rate card + customers.
-- Aligned to the v0 dashboard (lib/memory-store.ts): same metrics, prices,
-- customer ids/names/thresholds, so DSQL-backed and preview behave identically.
-- Safe to re-run: ON CONFLICT DO NOTHING on natural keys.

-- Rate card — must cover every metric the "Simulate usage" button emits
-- (api_call, gb_stored, seat, compute_ms, egress_gb). Prices in integer cents.
INSERT INTO pricing (metric, unit_price_cents) VALUES
    ('api_call',   2),     -- $0.02 per API call
    ('gb_stored', 12),     -- $0.12 per GB stored
    ('seat',    1500),     -- $15.00 per seat
    ('compute_ms', 1),     -- $0.01 per compute-ms
    ('egress_gb',  9),     -- $0.09 per GB egress
    ('credit',     1)      -- correction line: 1c per unit, credits use negative quantity
ON CONFLICT (metric) DO NOTHING;

-- Customers (stable ids matching the v0 preview seed).
INSERT INTO customers (id, name, plan, spend_threshold_cents) VALUES
    ('11111111-1111-4111-8111-111111111111', 'Northwind Logistics', 'Scale',   50000),
    ('22222222-2222-4222-8222-222222222222', 'Helios Robotics',     'Growth',  25000),
    ('33333333-3333-4333-8333-333333333333', 'Atlas Mapping Co.',   'Starter', 10000)
ON CONFLICT (id) DO NOTHING;
