// POST /api/rollup — manual "Run roll-up now" trigger for the demo.
//
// Runs the exact same idempotent upsert as the roll-up Lambda (sql/rollup.sql),
// so demoing on demand produces the same invoices a scheduled run would. Re-running
// does not create duplicates.

import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const ROLLUP_SQL = `
WITH cycle AS (
    SELECT date_trunc('month', now())                      AS period_start,
           date_trunc('month', now()) + interval '1 month' AS period_end
),
agg AS (
    SELECT e.customer_id, e.metric,
           SUM(e.quantity)                              AS quantity,
           p.unit_price_cents,
           SUM(e.quantity * p.unit_price_cents)::bigint AS subtotal_cents
    FROM usage_events e
    JOIN pricing p ON p.metric = e.metric
    CROSS JOIN cycle c
    WHERE e.event_time >= c.period_start AND e.event_time < c.period_end
    GROUP BY e.customer_id, e.metric, p.unit_price_cents
),
lines AS (
    SELECT customer_id,
           jsonb_agg(jsonb_build_object(
               'metric', metric, 'quantity', quantity,
               'unit_price_cents', unit_price_cents, 'subtotal_cents', subtotal_cents
           ) ORDER BY metric)        AS line_items,
           SUM(subtotal_cents)::bigint AS total_cents
    FROM agg GROUP BY customer_id
)
INSERT INTO invoices (customer_id, period_start, period_end, total_cents, line_items, status)
SELECT l.customer_id, c.period_start, c.period_end, l.total_cents, l.line_items, 'issued'
FROM lines l CROSS JOIN cycle c
ON CONFLICT (customer_id, period_start, period_end)
DO UPDATE SET total_cents = EXCLUDED.total_cents,
              line_items  = EXCLUDED.line_items,
              status      = 'issued'
RETURNING *;
`;

export async function POST() {
  const invoices = await query(ROLLUP_SQL);
  return NextResponse.json({ invoices }, { status: 200 });
}
