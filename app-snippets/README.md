# app-snippets — what to swap into the v0 project

These are the **infra-aware** files that replace v0's plain-Postgres placeholders.
v0 generates the UI + boilerplate routes; you copy these in afterward.

## Steps

1. Generate the dashboard in **v0.app** using `docs/V0_PROMPT.md`, click Deploy.
2. Pull the v0 repo locally (or edit in v0), then add deps:
   ```bash
   npm i pg @aws-sdk/dsql-signer @aws-sdk/client-sqs
   npm i -D @types/pg
   ```
3. Copy these files in (paths are relative to the Next.js app root):

   | snippet | dest | what it does |
   |---|---|---|
   | `lib/db.ts` | `lib/db.ts` | DSQL pool with **IAM-token auth** (the one DSQL gotcha) |
   | `lib/queries.ts` | `lib/queries.ts` | canonical meter/invoice read queries — wire route handlers to these |
   | `app/api/ingest/route.ts` | `app/api/ingest/route.ts` | replaces v0's direct insert → **enqueues to SQS** |
   | `app/api/rollup/route.ts` | `app/api/rollup/route.ts` | manual "Run roll-up now" demo trigger (same upsert as the Lambda) |

   The read routes v0 made (`/api/customers`, `/api/customers/[id]/usage`, `/api/invoices`)
   just need their queries pointed at `lib/queries.ts` and their import switched to `lib/db.ts`.

4. In **Vercel → Settings → Environment Variables**, set everything in `.env.example`
   (real values). The AWS creds need `dsql:DbConnectAdmin` on the cluster and
   `sqs:SendMessage` on the queue.

5. Deploy. Click **Simulate usage** → events buffer through SQS → drainer Lambda
   writes them into DSQL → the live meter ticks up. Click **Run roll-up now** → an
   invoice appears.

## Note on `@/` imports

`app/api/rollup/route.ts` imports `@/lib/db`. If the v0 project doesn't have the
`@/*` path alias, change it to a relative import or add to `tsconfig.json`:
```json
{ "compilerOptions": { "paths": { "@/*": ["./*"] } } }
```
