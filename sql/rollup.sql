-- Ledgerline invoice roll-up — close the current cycle into one invoice per customer.
--
-- Idempotent: upsert on (customer_id, period_start, period_end). Re-running the
-- roll-up updates the existing invoice instead of creating a duplicate. This is
-- the roll-up's version of "never double-count".
--
-- Cycle = current calendar month. Used by the scheduled roll-up Lambda.
--
-- NOTE: this SQL prices flat (quantity * unit_price_cents). The app-layer roll-up
-- (frontend/lib/rollup.ts, used by the "Run roll-up now" button) applies graduated
-- volume tiers via buildBreakdown — that is the authoritative, tier-aware path.

WITH cycle AS (
    SELECT date_trunc('month', now())                          AS period_start,
           date_trunc('month', now()) + interval '1 month'     AS period_end
),
agg AS (
    SELECT e.customer_id,
           e.metric,
           SUM(e.quantity)                              AS quantity,
           p.unit_price_cents,
           SUM(e.quantity * p.unit_price_cents)::bigint AS subtotal_cents
    FROM usage_events e
    JOIN pricing p ON p.metric = e.metric
    CROSS JOIN cycle c
    WHERE e.event_time >= c.period_start
      AND e.event_time <  c.period_end
    GROUP BY e.customer_id, e.metric, p.unit_price_cents
),
lines AS (
    SELECT customer_id,
           jsonb_agg(
               jsonb_build_object(
                   'metric',           metric,
                   'quantity',         quantity,
                   'unit_price_cents', unit_price_cents,
                   'subtotal_cents',   subtotal_cents
               ) ORDER BY metric
           )                       AS line_items,
           SUM(subtotal_cents)::bigint AS total_cents
    FROM agg
    GROUP BY customer_id
)
INSERT INTO invoices (customer_id, period_start, period_end, total_cents, line_items, status)
SELECT l.customer_id, c.period_start, c.period_end, l.total_cents, l.line_items, 'issued'
FROM lines l
CROSS JOIN cycle c
ON CONFLICT (customer_id, period_start, period_end)
DO UPDATE SET total_cents = EXCLUDED.total_cents,
              line_items  = EXCLUDED.line_items,
              status      = 'issued'
RETURNING *;
