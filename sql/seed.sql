-- Ledgerline seed data: rate card + customers.
-- Aligned to the v0 dashboard (lib/memory-store.ts): same metrics, prices,
-- customer ids/names/thresholds, so DSQL-backed and preview behave identically.
-- Safe to re-run: ON CONFLICT DO NOTHING on natural keys.

-- Rate card — must cover every metric the "Simulate usage" button emits
-- (api_call, gb_stored, seat, compute_ms, egress_gb). Prices in integer cents.
INSERT INTO pricing (metric, unit_price_cents, tiers) VALUES
    ('api_call',   2, '[{"upToQty":5000,"unitPriceCents":2},{"upToQty":null,"unitPriceCents":1}]'::jsonb), -- volume: first 5k @ 2c, beyond @ 1c
    ('gb_stored', 12, NULL),   -- $0.12 per GB stored
    ('seat',    1500, NULL),   -- $15.00 per seat
    ('compute_ms', 1, NULL),   -- $0.01 per compute-ms
    ('egress_gb',  9, NULL),   -- $0.09 per GB egress
    ('credit',     1, NULL)    -- correction line: 1c per unit, credits use negative quantity
ON CONFLICT (metric) DO UPDATE
    SET unit_price_cents = EXCLUDED.unit_price_cents,
        tiers            = EXCLUDED.tiers;

-- Customers (stable ids matching the v0 preview seed).
INSERT INTO customers (id, name, plan, spend_threshold_cents) VALUES
    ('11111111-1111-4111-8111-111111111111', 'Northwind Logistics', 'Scale',   50000),
    ('22222222-2222-4222-8222-222222222222', 'Helios Robotics',     'Growth',  25000),
    ('33333333-3333-4333-8333-333333333333', 'Atlas Mapping Co.',   'Starter', 10000)
ON CONFLICT (id) DO NOTHING;

-- Prepaid commitments (Atlas intentionally has none — shows the empty state).
INSERT INTO credit_grants (id, customer_id, amount_cents, note) VALUES
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 100000, 'Annual commitment'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222',  75000, 'Annual commitment')
ON CONFLICT (id) DO NOTHING;
