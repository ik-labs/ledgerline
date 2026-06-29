# CLAUDE.md — Ledgerline

> This file orients Claude Code on the project. Read `docs/V1_SCOPE.md` and `docs/ARCHITECTURE.md` before writing code. Use `docs/V0_PROMPT.md` for the frontend scaffold (generated in v0, not here).

## What this is

**Ledgerline** — usage-based billing infrastructure for B2B SaaS, built on **Aurora DSQL** for a strongly-consistent meter with no primary/replica setup. Submission for the **H0 Hackathon, Track 2 (Monetizable B2B)**.

## The thesis (don't lose sight of this)

The database is the product. The win is a deliberate DSQL data model + a buffered, never-dropped, never-double-counted ingestion path. The UI is the fast part (v0); engineering hours go to the ledger and the consistency story. Anything that doesn't show in a <3-min demo or the architecture diagram is out of scope for v1.

## Document map

| File | Purpose |
|---|---|
| `docs/V1_SCOPE.md` | **Primary spec.** What to build, data model, access patterns, build order, submission checklist. Start here. |
| `docs/ARCHITECTURE.md` | How the pieces fit and why each exists. Contains the Mermaid system diagram (export to PNG for submission). |
| `docs/V0_PROMPT.md` | Paste-in prompts for v0.app to generate the dashboard + API routes. |
| `CLAUDE.md` | This file. |

## Stack

- Next.js (App Router) + TypeScript + Tailwind — generated in v0, deployed on Vercel.
- Aurora DSQL (Postgres-compatible) — the ledger.
- Amazon SQS — usage-event buffer.
- AWS Lambda — queue drainer + invoice roll-up.
- EventBridge Scheduler — close-of-cycle trigger.
- (Optional) Amazon SNS — threshold alerts.

## Hard rules

1. **Single-region only.** Multi-region is narrated design intent, not built (cost + time). Do not create a multi-region cluster.
2. **Money in integer cents** everywhere; format to currency only in the UI.
3. **`usage_events` is append-only.** No UPDATE/DELETE in app code. Corrections are new events.
4. **Idempotent inserts** via `idempotency_key` unique constraint — this is what makes "never double-count" real.
5. **No secrets in the repo.** Repo is public for submission. All credentials in Vercel env vars.
6. **DSQL auth is IAM-token based**, not a static password. The connection layer mints a short-lived token via the AWS SDK before connecting. This is the one real DSQL gotcha — handle it in an isolated connection module.
7. **Set a $1 AWS budget alert before creating any resource.** Tear down the DSQL cluster when done.

## Build order (from V1_SCOPE §4)

1. DSQL cluster + schema + seed (riskiest integration first).
2. Read endpoints + dashboard skeleton (something on screen).
3. Ingest path: `/api/ingest` → SQS → drainer Lambda → DSQL (meter moves).
4. Simulate/seed path for the demo.
5. Invoice roll-up Lambda + EventBridge schedule + manual trigger.
6. (Optional) SNS threshold alert.
7. Proof screenshot + diagram export + demo recording.

## Definition of done for v1

A deployed Vercel dashboard where: you click Simulate, the live meter ticks up (events buffered through SQS, written to DSQL idempotently), and you can run a roll-up that produces an invoice with line items — all on a single-region Aurora DSQL ledger, with a clean architecture diagram and a proof screenshot for submission.
