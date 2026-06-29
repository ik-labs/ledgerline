// Ledgerline invoice roll-up Lambda.
//
// Triggered by EventBridge Scheduler at close-of-cycle. Aggregates the current
// cycle's usage into one invoice per customer, idempotently (upsert on
// customer_id + period), so a re-run never creates duplicate invoices.
//
// The SQL is kept identical to sql/rollup.sql and to the manual POST /api/rollup
// demo trigger — one definition of "close the books".
//
// Env: DSQL_ENDPOINT, DSQL_DATABASE, DSQL_USER, AWS_REGION

import pg from "pg";
import { DsqlSigner } from "@aws-sdk/dsql-signer";

const { Pool } = pg;

const ENDPOINT = process.env.DSQL_ENDPOINT;
const REGION = process.env.AWS_REGION ?? "us-east-1";
const USER = process.env.DSQL_USER ?? "admin";
const DATABASE = process.env.DSQL_DATABASE ?? "postgres";

const signer = new DsqlSigner({ hostname: ENDPOINT, region: REGION });

async function mintToken() {
  return USER === "admin"
    ? signer.getDbConnectAdminAuthToken()
    : signer.getDbConnectAuthToken();
}

let pool;
function getPool() {
  if (!pool) {
    pool = new Pool({
      host: ENDPOINT,
      port: 5432,
      user: USER,
      database: DATABASE,
      password: mintToken,
      ssl: { rejectUnauthorized: true },
      max: 1,
      maxLifetimeSeconds: 600,
    });
  }
  return pool;
}

export const ROLLUP_SQL = `
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

export async function handler() {
  const db = getPool();
  const { rows } = await db.query(ROLLUP_SQL);
  console.log(`rolled up ${rows.length} invoice(s)`);
  return { invoices: rows.length };
}
