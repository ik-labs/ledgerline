-- Ledgerline seed data: rate card + sample customers.
-- Safe to re-run: ON CONFLICT DO NOTHING on natural keys.

-- Rate card (prices in integer cents per 1 unit of quantity)
INSERT INTO pricing (metric, unit_price_cents) VALUES
    ('api_call',  2),      -- $0.02 per API call
    ('gb_stored', 15),     -- $0.15 per GB stored
    ('seat',      4900)    -- $49.00 per seat
ON CONFLICT (metric) DO NOTHING;

-- Sample customers with stable ids so the demo + simulate path are reproducible.
INSERT INTO customers (id, name, plan, spend_threshold_cents) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Acme Corp',     'Scale',   50000),
    ('22222222-2222-2222-2222-222222222222', 'Globex',        'Growth',  20000),
    ('33333333-3333-3333-3333-333333333333', 'Initech',       'Starter',  5000)
ON CONFLICT (id) DO NOTHING;
