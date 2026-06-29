-- Optional demo baseline: populate usage_events for the CURRENT cycle so the
-- dashboard looks alive on first load (mirrors lib/memory-store.ts seedEvents()).
--
-- Idempotent: idempotency_key is deterministic ('seed-<customer>-<metric>-<n>'),
-- so re-running does NOT create duplicates — the unique index dedupes them.
--
-- Run once after seed.sql:  infra/scripts/dsql.sh -f sql/seed-events.sql

INSERT INTO usage_events (customer_id, metric, quantity, event_time, idempotency_key)
SELECT
    plan.customer_id,
    plan.metric,
    -- random quantity in [qmin, qmax], 2 decimals (seats stay whole-ish via small range)
    round((plan.qmin + random() * (plan.qmax - plan.qmin))::numeric, 2),
    -- spread across the current cycle, from month start up to "now"
    date_trunc('month', now()) + random() * (now() - date_trunc('month', now())),
    'seed-' || plan.customer_id || '-' || plan.metric || '-' || g
FROM (VALUES
    ('11111111-1111-4111-8111-111111111111'::uuid, 'api_call',   40,  200, 1200),
    ('11111111-1111-4111-8111-111111111111'::uuid, 'gb_stored',   8,   50,  220),
    ('11111111-1111-4111-8111-111111111111'::uuid, 'seat',        3,    1,    4),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'api_call',   26,  100,  600),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'compute_ms', 14,  500, 5000),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'egress_gb',   6,    5,   40),
    ('33333333-3333-4333-8333-333333333333'::uuid, 'api_call',   12,   50,  300),
    ('33333333-3333-4333-8333-333333333333'::uuid, 'gb_stored',   4,   10,   60)
) AS plan(customer_id, metric, cnt, qmin, qmax),
LATERAL generate_series(1, plan.cnt) AS g
ON CONFLICT (idempotency_key) DO NOTHING;
