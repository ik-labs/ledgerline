# Ledgerline — v0 Prompt

This document contains the paste-in prompt(s) for **v0.app** to scaffold the Ledgerline frontend + API routes. v0 builds the dashboard and Next.js server routes; the AWS pipeline (SQS, Lambda, DSQL cluster) you build separately per `V1_SCOPE.md`.

> **Key framing for v0:** Aurora DSQL is **PostgreSQL-compatible**, so prompt v0 as a normal Postgres app. Do *not* mention DSQL's IAM-token auth in the v0 prompt — handle that yourself in the connection layer afterward, or v0 may over-engineer it. Keep v0 focused on UI + query shape.

---

## How to use this

1. Open **v0.app**, start a new project.
2. Paste **Prompt 1** (main scaffold). Let it generate.
3. Iterate with the **follow-up prompts** as needed.
4. Click **Deploy** → creates the Vercel project + `*.vercel.app` URL.
5. In Vercel → Settings → Environment Variables, add the DSQL/AWS vars from `V1_SCOPE.md §5`.
6. Replace v0's placeholder DB connection with your DSQL connection layer (IAM token auth).

---

## Prompt 1 — Main scaffold (paste this first)

```
Build a usage-based billing dashboard called "Ledgerline" using Next.js (App Router),
TypeScript, and Tailwind CSS. It connects to a PostgreSQL database via environment
variables. This is B2B billing infrastructure — the UI should feel like a clean,
trustworthy financial product (think Stripe/Linear): restrained, data-dense, monospace
for numbers, generous whitespace, no marketing fluff.

PAGES:

1. Customers list (/)
   - A table of customers: name, plan, current running total this billing cycle
     (formatted as currency), and a small status indicator.
   - Click a row → go to customer detail.
   - Clean empty state.

2. Customer detail (/customers/[id])
   - Header: customer name, plan, current cycle running cost (large, prominent).
   - "Live meter" panel: a running total of usage cost that updates as new events
     arrive. Show a breakdown by metric (e.g. api_call, gb_stored, seat) with
     quantity and subtotal per metric.
   - "Recent events" feed: newest usage events first, each showing metric, quantity,
     and timestamp, in plain language. Should feel like it's ticking up live.
   - A "Simulate usage" button that posts sample usage events (for demos).

3. Invoices (/invoices)
   - A table of rolled-up invoices: customer, billing period, total, status
     (draft/issued), created date. Newest first.
   - Click an invoice → expand to show line items (metric, quantity, unit price, subtotal).

API ROUTES (Next.js route handlers, server-side):

- POST /api/ingest
    Accepts a usage event: { customer_id, metric, quantity, event_time, idempotency_key }.
    For now, insert directly into a usage_events table. (I will later swap this to enqueue
    to a message queue instead of writing directly — keep the handler logic isolated so
    that swap is easy.)
    Use an idempotent insert: ON CONFLICT (idempotency_key) DO NOTHING.

- GET /api/customers
    Returns customers with their running total for the current cycle (sum of
    quantity * unit_price per metric, joined to a pricing table).

- GET /api/customers/[id]/usage
    Returns the customer's running cost broken down by metric, plus the most recent
    usage events.

- GET /api/invoices
    Returns invoices newest-first with line_items.

DATABASE TABLES (PostgreSQL):

customers(id uuid pk, name text, plan text, spend_threshold_cents bigint,
          created_at timestamptz)
usage_events(id uuid pk, customer_id uuid, metric text, quantity numeric,
             event_time timestamptz, idempotency_key text unique, created_at timestamptz)
pricing(metric text pk, unit_price_cents bigint)
invoices(id uuid pk, customer_id uuid, period_start timestamptz, period_end timestamptz,
         total_cents bigint, line_items jsonb, status text, created_at timestamptz)

Money is always stored in integer cents and formatted to currency only in the UI.
Do NOT use HTML <form> tags — use button onClick handlers.
Include a SQL seed snippet that inserts a pricing rate card and 3 sample customers.
```

---

## Follow-up prompts (use as needed)

### 2 — Make the meter feel live
```
On the customer detail page, make the live meter poll GET /api/customers/[id]/usage
every 2 seconds and animate the running total counting up when it changes. The recent
events feed should prepend new events with a subtle highlight. Keep it lightweight —
no websockets, just polling.
```

### 3 — Tighten the financial-product aesthetic
```
Refine the visual design: use a monospace font for all numeric/currency values, a
neutral near-monochrome palette with a single restrained accent color, clear table
typography, and subtle borders rather than heavy cards. It should read as
trustworthy billing infrastructure, not a consumer app. Add a thin top nav with
Ledgerline wordmark and links: Customers, Invoices.
```

### 4 — Simulate button for the demo
```
The "Simulate usage" button on the customer detail page should POST 5-10 randomized
usage events (varied metrics and quantities, each with a unique idempotency_key and
current timestamp) to /api/ingest with a short delay between them, so the live meter
visibly ticks up on screen. Show a small toast when done.
```

### 5 — Invoice roll-up trigger for the demo
```
On the invoices page, add an admin-only "Run roll-up now" button that calls a
POST /api/rollup endpoint. That endpoint aggregates the current cycle's usage_events
for each customer into an invoice (upsert on customer_id + period, so re-running does
not create duplicates) and returns the created invoices. This lets me demo invoice
generation on demand instead of waiting for a schedule.
```

---

## After v0: what YOU swap in (not v0's job)

These are deliberately left out of the v0 prompt because they're infra, not UI. Do them in Claude Code locally per `V1_SCOPE.md`:

1. **DSQL connection layer** — replace v0's plain Postgres connection with one that mints an IAM auth token before connecting. This is the DSQL-specific step.
2. **Swap `/api/ingest`** from direct DB insert → enqueue to SQS. (The prompt already isolates this handler so the swap is clean.)
3. **SQS drainer Lambda** — writes events to DSQL with the idempotent insert.
4. **Roll-up Lambda + EventBridge schedule** — the `/api/rollup` logic also runs on a schedule.
5. **(Optional) SNS threshold alert** inside the drainer.

> The point of using v0 here: it burns down the UI + boilerplate-route work in minutes so your hours go to the DSQL ledger, the SQS-buffered ingest, and the consistency story — the things that actually score on Technical Implementation.
