// Canonical read queries for Ledgerline.
//
// "Current cycle" = current calendar month (date_trunc('month', now())).
// Money is always integer cents; format to currency only in the UI.
//
// These are the source of truth for the meter math. Wire the v0 route handlers
// to call these so totals agree everywhere.

import { query } from "./db";

export type CustomerRow = {
  id: string;
  name: string;
  plan: string;
  running_total_cents: string; // bigint comes back as string from pg
};

export type MetricBreakdownRow = {
  metric: string;
  quantity: string;
  unit_price_cents: string;
  subtotal_cents: string;
};

export type UsageEventRow = {
  id: string;
  metric: string;
  quantity: string;
  event_time: string;
};

export type InvoiceRow = {
  id: string;
  customer_id: string;
  period_start: string;
  period_end: string;
  total_cents: string;
  line_items: unknown;
  status: string;
  created_at: string;
};

/** Customers + running cost this cycle. */
export function listCustomers() {
  return query<CustomerRow>(`
    SELECT c.id, c.name, c.plan,
           COALESCE(SUM(e.quantity * p.unit_price_cents), 0)::bigint AS running_total_cents
    FROM customers c
    LEFT JOIN usage_events e
      ON e.customer_id = c.id
     AND e.event_time >= date_trunc('month', now())
    LEFT JOIN pricing p ON p.metric = e.metric
    GROUP BY c.id, c.name, c.plan
    ORDER BY c.name
  `);
}

/** Per-metric breakdown of this cycle's cost for one customer. */
export function customerMetricBreakdown(customerId: string) {
  return query<MetricBreakdownRow>(
    `
    SELECT e.metric,
           SUM(e.quantity)::numeric                         AS quantity,
           p.unit_price_cents,
           SUM(e.quantity * p.unit_price_cents)::bigint     AS subtotal_cents
    FROM usage_events e
    JOIN pricing p ON p.metric = e.metric
    WHERE e.customer_id = $1
      AND e.event_time >= date_trunc('month', now())
    GROUP BY e.metric, p.unit_price_cents
    ORDER BY e.metric
  `,
    [customerId],
  );
}

/** Newest usage events for the live feed. */
export function recentEvents(customerId: string, limit = 20) {
  return query<UsageEventRow>(
    `
    SELECT id, metric, quantity, event_time
    FROM usage_events
    WHERE customer_id = $1
    ORDER BY event_time DESC
    LIMIT $2
  `,
    [customerId, limit],
  );
}

/** All invoices, newest first. */
export function listInvoices() {
  return query<InvoiceRow>(`
    SELECT id, customer_id, period_start, period_end,
           total_cents, line_items, status, created_at
    FROM invoices
    ORDER BY created_at DESC
  `);
}
