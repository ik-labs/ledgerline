# Ledgerline

Usage-based billing infrastructure for B2B SaaS, built on **Aurora DSQL** for a
strongly-consistent meter with no primary/replica setup. H0 Hackathon — Track 2.

See `docs/` for the full spec (`V1_SCOPE.md`), architecture (`ARCHITECTURE.md`),
and the v0 frontend prompt (`V0_PROMPT.md`).

## Layout

```
docs/            spec, architecture, v0 prompt
sql/             schema.sql, seed.sql, rollup.sql  (DSQL-aware DDL/queries)
infra/
  scripts/       dsql.sh (connect w/ IAM token), deploy-lambdas.sh
  lambdas/
    drainer/     SQS -> idempotent insert into DSQL
    rollup/      EventBridge -> aggregate cycle -> invoice (upsert)
app-snippets/    infra-aware files to copy into the v0 Next.js project
```

## Live AWS resources (us-east-1, account 904907793501)

| Resource | Identifier |
|---|---|
| DSQL cluster | `ijt4jtjkn7oxftooklnuliggna` |
| DSQL endpoint | `ijt4jtjkn7oxftooklnuliggna.dsql.us-east-1.on.aws` |
| SQS queue | `ledgerline-usage-events` |
| Drainer Lambda | `ledgerline-drainer` (SQS-triggered) |
| Roll-up Lambda | `ledgerline-rollup` (EventBridge daily 00:00 UTC) |
| Budget alert | `ledgerline-1usd` ($1, email) |

## Operating

```bash
# connect to DSQL (mints a fresh IAM token each time)
infra/scripts/dsql.sh

# (re)apply schema / seed
infra/scripts/dsql.sh -f sql/schema.sql
infra/scripts/dsql.sh -f sql/seed.sql

# deploy / update the Lambdas + triggers
infra/scripts/deploy-lambdas.sh

# run the roll-up on demand
aws lambda invoke --function-name ledgerline-rollup --region us-east-1 /dev/stdout
```

## Status

- [x] $1 budget alert
- [x] DSQL cluster + schema + seed (idempotency proven)
- [x] IAM-token connection layer
- [x] SQS queue + ingest swap
- [x] Drainer Lambda (SQS → DSQL, idempotent) — deployed & tested live
- [x] Roll-up Lambda + EventBridge schedule — deployed & tested live
- [ ] v0 frontend (generate in v0.app, swap in `app-snippets/`)
- [ ] (optional) SNS threshold alert
- [ ] Demo recording + architecture diagram export + proof screenshot

## Teardown (after submission)

```bash
aws dsql delete-cluster --identifier ijt4jtjkn7oxftooklnuliggna --region us-east-1
aws sqs delete-queue --queue-url https://sqs.us-east-1.amazonaws.com/904907793501/ledgerline-usage-events
aws lambda delete-function --function-name ledgerline-drainer --region us-east-1
aws lambda delete-function --function-name ledgerline-rollup --region us-east-1
aws scheduler delete-schedule --name ledgerline-rollup-daily --region us-east-1
```
