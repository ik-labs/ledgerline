# Ledgerline — v1 Scope

**Status:** ready for Claude Code
**Track:** H0 Hackathon — Track 2 (Monetizable B2B App)
**One-liner:** Usage-based billing infrastructure for B2B SaaS, built on Aurora DSQL for a strongly-consistent meter with no primary/replica setup.

> Read `ARCHITECTURE.md` alongside this. This document defines **what to build for v1**; the architecture doc defines **how the pieces fit and why**.

---

## 0. Build philosophy (read first)

- **The database is the product.** Judges (AWS Databases org) reward a deliberate data model and ingestion design, and explicitly penalize "I prompted v0 and submitted." The DSQL schema, the SQS-buffered ingest, and the consistent-meter design are the substance. The UI is the accelerated part.
- **Spec-first.** Build to this doc. If something here is ambiguous, resolve it in favor of the simplest thing that demos the "never double-count, same totals everywhere" story.
- **Single-region only for v1.** Multi-region is a narrated design intent, not a built feature (cost + time).
- **Demo-driven scope.** Every feature must earn its place in a <3-minute video. If it doesn't show on screen or in the architecture diagram, defer it.

---

## 1. What v1 must do (functional scope)

### In scope
1. **Ingest usage events** via an API endpoint, buffered through SQS, drained into DSQL by a Lambda.
2. **Store a strongly-consistent ledger** in Aurora DSQL: customers, usage events, invoices.
3. **Show a live meter**: per-customer running usage total and cost, updating as events arrive.
4. **Apply pricing**: rate × usage = charge, per metric.
5. **Roll up invoices**: a scheduled Lambda closes a billing cycle into an invoice row.
6. **Dashboard** (v0/Next.js on Vercel): customer list → customer detail (live meter) → invoices.
7. **A seed/simulate path** to generate usage events for the demo (so the meter visibly moves on camera).

### Explicitly OUT of scope for v1 (defer / narrate only)
- Multi-region cluster (narrate as design intent).
- Auth / multi-user login (stub or single-tenant demo; don't burn DSQL hours on identity).
- Payment collection, dunning, tax, ERP integrations (this is Orb's surface area — not ours).
- Price experimentation / versioned pricing.
- S3 raw-event archive (show as "future" box in diagram).
- Real customer onboarding flows.

---

## 2. Data model (Aurora DSQL — Postgres-compatible)

Three tables. Keep it tight; the clarity of this schema is a scored asset.

### `customers`
| column | type | notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `name` | `text` not null | e.g. "Acme Corp" |
| `plan` | `text` not null | free-text plan label for v1 |
| `spend_threshold_cents` | `bigint` null | optional; triggers SNS alert if crossed |
| `created_at` | `timestamptz` not null default `now()` |

### `usage_events` (append-only — the meter)
| column | type | notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `customer_id` | `uuid` not null | FK → customers.id |
| `metric` | `text` not null | e.g. "api_call", "gb_stored", "seat" |
| `quantity` | `numeric` not null | how much of the metric |
| `event_time` | `timestamptz` not null | when the usage happened |
| `idempotency_key` | `text` not null unique | **never double-count** — dedupe key from the producer |
| `created_at` | `timestamptz` not null default `now()` |

> **Index:** `(customer_id, event_time)` for fast per-customer meter reads.
> **Append-only:** no UPDATE/DELETE on this table in app code. Corrections are new events.
> **Idempotency:** the unique `idempotency_key` is what makes "never double-count" real — a re-delivered SQS message inserts once. Call this out in the demo.

### `pricing` (simple v1 rate card)
| column | type | notes |
|---|---|---|
| `metric` | `text` PK | matches usage_events.metric |
| `unit_price_cents` | `bigint` not null | charge per 1 unit of quantity |

### `invoices`
| column | type | notes |
|---|---|---|
| `id` | `uuid` PK | |
| `customer_id` | `uuid` not null | FK → customers.id |
| `period_start` | `timestamptz` not null | |
| `period_end` | `timestamptz` not null | |
| `total_cents` | `bigint` not null | computed at roll-up |
| `line_items` | `jsonb` not null | `[{metric, quantity, unit_price_cents, subtotal_cents}]` |
| `status` | `text` not null | "draft" → "issued" |
| `created_at` | `timestamptz` not null default `now()` |

> **Uniqueness:** one invoice per `(customer_id, period_start, period_end)` — re-running the roll-up must not create duplicate invoices (upsert / guard). This is the roll-up's version of "never double-count."

---

## 3. Access patterns (what the app actually does)

| Pattern | Path | Reads/Writes |
|---|---|---|
| Ingest a usage event | `POST /api/ingest` | enqueue → SQS (no direct DB write) |
| Drain queue → ledger | Lambda (SQS trigger) | `INSERT INTO usage_events ... ON CONFLICT (idempotency_key) DO NOTHING` |
| Live meter for a customer | `GET /api/customers/:id/usage` | sum(quantity × unit_price) grouped by metric, plus recent events |
| List customers | `GET /api/customers` | select customers + their running total |
| List invoices | `GET /api/invoices` | select invoices, newest first |
| Close a cycle | Lambda (EventBridge schedule) | read usage in window → upsert invoice |
| Threshold alert (optional) | inside drainer | if running total crosses `spend_threshold_cents` → SNS publish |

---

## 4. Component build order (suggested for Claude Code)

Build in this order so there's something on screen early and the risky DSQL bits are validated first.

1. **DSQL cluster + schema.** Create cluster in AWS console, run the DDL from §2, seed `pricing` and a few `customers`. Validate you can connect with a standard Postgres driver. *(Riskiest integration — do it first.)*
2. **Read path + dashboard skeleton.** Next.js read endpoints (`/api/customers`, `/api/customers/:id/usage`, `/api/invoices`) querying DSQL. Wire to v0-generated UI. Now the meter renders (even if static).
3. **Ingest path.** `POST /api/ingest` → SQS. Lambda drainer → DSQL with idempotent insert. Now the meter *moves*.
4. **Simulate button / seed script.** Generate a stream of usage events for the demo so the meter visibly accrues on camera.
5. **Invoice roll-up Lambda** + EventBridge schedule (and a manual "run roll-up now" trigger for the demo — don't wait for a real cron during recording).
6. **(Optional) SNS threshold alert.**
7. **Proof screenshot + architecture diagram + demo recording.**

---

## 5. Tech stack

- **Frontend/API:** Next.js (App Router), Tailwind — generated via v0, deployed on Vercel. See `V0_PROMPT.md`.
- **Database:** Aurora DSQL (Postgres-compatible). Use a standard PG driver/connection string; DSQL needs IAM-based auth token as the password — handle that in the connection layer.
- **Queue:** Amazon SQS (standard queue).
- **Compute:** AWS Lambda (drainer + roll-up).
- **Schedule:** Amazon EventBridge Scheduler.
- **Alerts (optional):** Amazon SNS.
- **Secrets:** Vercel Environment Variables (`DSQL_ENDPOINT`, `DSQL_DATABASE`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SQS_QUEUE_URL`, optional `SNS_TOPIC_ARN`). Never commit secrets — repo is public.

> **DSQL connection note:** Aurora DSQL uses IAM auth — the DB "password" is a short-lived token generated from AWS credentials, not a static password. The connection layer must mint this token (via AWS SDK) before connecting. Budget a little time here; it's the one place DSQL differs from vanilla Postgres and the most likely source of friction.

---

## 6. Submission checklist (map build → what H0 requires)

- [ ] Text description naming the AWS database used (**Aurora DSQL**) + which track (**Track 2 B2B**).
- [ ] <3-min demo video on YouTube: problem → who it's for → why DSQL → working app footage → name the database.
- [ ] Published Vercel project link (`*.vercel.app`).
- [ ] Vercel Team ID (Settings → General → Team ID).
- [ ] Architecture diagram (export from `ARCHITECTURE.md` Mermaid → PNG/SVG).
- [ ] Screenshot proving AWS DB usage (DSQL cluster in AWS console, or Vercel Storage config).
- [ ] Public GitHub repo (no secrets committed).
- [ ] *(Bonus +0.2 each, up to +0.6)* Publish a build write-up (dev.to / LinkedIn / Medium / YouTube) with "created for this hackathon" language + **#H0Hackathon**.

---

## 7. The pitch sentence (use verbatim as the demo opener)

> "Ledgerline is usage-based billing infrastructure for B2B SaaS — the part of the stack every company dreads building — rebuilt on Aurora DSQL so the meter stays strongly consistent across regions with no primary, no replica, and no failover to manage. Every billable event is buffered so it's never dropped, and recorded once so it's never double-counted."
