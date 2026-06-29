// Ledgerline drainer Lambda.
//
// Triggered by SQS. For each buffered usage event, performs an IDEMPOTENT insert
// into the Aurora DSQL `usage_events` table:
//
//   INSERT ... ON CONFLICT (idempotency_key) DO NOTHING
//
// This is where "never double-count" becomes real: SQS is at-least-once, so the
// same message may arrive twice — the unique idempotency_key guarantees it lands
// in the ledger exactly once.
//
// Uses partial batch response: only failed records are returned to SQS for retry,
// so one bad message doesn't replay the whole batch.
//
// Optional: if a customer crosses spend_threshold_cents this cycle, publish SNS.
//
// Env: DSQL_ENDPOINT, DSQL_DATABASE, DSQL_USER, AWS_REGION, SNS_TOPIC_ARN (optional)

import pg from "pg";
import { DsqlSigner } from "@aws-sdk/dsql-signer";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const { Pool } = pg;

const ENDPOINT = process.env.DSQL_ENDPOINT;
const REGION = process.env.AWS_REGION ?? "us-east-1";
const USER = process.env.DSQL_USER ?? "admin";
const DATABASE = process.env.DSQL_DATABASE ?? "postgres";
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;

const signer = new DsqlSigner({ hostname: ENDPOINT, region: REGION });
const sns = SNS_TOPIC_ARN ? new SNSClient({ region: REGION }) : null;

async function mintToken() {
  return USER === "admin"
    ? signer.getDbConnectAdminAuthToken()
    : signer.getDbConnectAuthToken();
}

// Reuse pool across warm invocations.
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
      idleTimeoutMillis: 30_000,
      maxLifetimeSeconds: 600,
    });
  }
  return pool;
}

const INSERT_SQL = `
  INSERT INTO usage_events (customer_id, metric, quantity, event_time, idempotency_key)
  VALUES ($1, $2, $3, $4, $5)
  ON CONFLICT (idempotency_key) DO NOTHING
`;

export async function handler(event) {
  const db = getPool();
  const batchItemFailures = [];
  // customerId -> idempotency_keys actually inserted this batch
  const insertedByCustomer = new Map();

  for (const record of event.Records ?? []) {
    try {
      const e = JSON.parse(record.body);
      if (!e.customer_id || !e.metric || e.quantity == null || !e.idempotency_key) {
        // Malformed: drop it (don't retry forever). Log for visibility.
        console.warn("skipping malformed event", record.messageId, record.body);
        continue;
      }
      const res = await db.query(INSERT_SQL, [
        e.customer_id,
        e.metric,
        Number(e.quantity),
        e.event_time ?? new Date().toISOString(),
        e.idempotency_key,
      ]);
      if (res.rowCount > 0) {
        const keys = insertedByCustomer.get(e.customer_id) ?? [];
        keys.push(e.idempotency_key);
        insertedByCustomer.set(e.customer_id, keys);
      }
    } catch (err) {
      console.error("failed record", record.messageId, err);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  // Threshold alert — fire ONCE, only when this batch causes the crossing.
  if (sns && insertedByCustomer.size > 0) {
    for (const [customerId, keys] of insertedByCustomer) {
      try {
        await maybeAlertThreshold(db, customerId, keys);
      } catch (err) {
        console.error("threshold check failed", customerId, err);
      }
    }
  }

  return { batchItemFailures };
}

async function maybeAlertThreshold(db, customerId, batchKeys) {
  // total_after includes this batch; total_before excludes the keys we just
  // inserted. We alert only when before < threshold <= after (the crossing),
  // so a customer already over the limit doesn't get spammed every batch.
  const { rows } = await db.query(
    `
    SELECT c.name, c.spend_threshold_cents,
           COALESCE(SUM(e.quantity * p.unit_price_cents), 0)::bigint AS total_after,
           COALESCE(SUM(e.quantity * p.unit_price_cents)
                    FILTER (WHERE NOT (e.idempotency_key = ANY($2))), 0)::bigint AS total_before
    FROM customers c
    LEFT JOIN usage_events e
      ON e.customer_id = c.id
     AND e.event_time >= date_trunc('month', now())
    LEFT JOIN pricing p ON p.metric = e.metric
    WHERE c.id = $1
    GROUP BY c.name, c.spend_threshold_cents
  `,
    [customerId, batchKeys],
  );
  const row = rows[0];
  if (!row || row.spend_threshold_cents == null) return;

  const threshold = Number(row.spend_threshold_cents);
  const before = Number(row.total_before);
  const after = Number(row.total_after);
  if (before < threshold && after >= threshold) {
    await sns.send(
      new PublishCommand({
        TopicArn: SNS_TOPIC_ARN,
        Subject: `Ledgerline: ${row.name} crossed spend threshold`,
        Message:
          `${row.name} just crossed its ${threshold} cent spend threshold this cycle.\n\n` +
          `Cycle spend is now ${after} cents (was ${before}).`,
      }),
    );
  }
}
