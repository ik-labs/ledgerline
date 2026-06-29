import { randomUUID } from "crypto"
import pg from "pg"
import { DsqlSigner } from "@aws-sdk/dsql-signer"
import { memoryStore } from "./memory-store"

/**
 * Consistency stress test — the proof behind "never double-count".
 *
 * Fires many CONCURRENT idempotent inserts at the ledger, where a deliberate
 * fraction reuse the same idempotency_key. Two things get demonstrated:
 *
 *   1. Aurora DSQL is strongly consistent: its unique index admits each key
 *      exactly once no matter how many writers race -> recorded === uniqueKeys,
 *      doubleCounts === 0.
 *   2. DSQL uses optimistic concurrency control: when writers collide on the
 *      same row it raises a retryable serialization error (SQLSTATE 40001 /
 *      "OC..."). We retry those; `conflictsRetried` shows how many real
 *      concurrent collisions DSQL caught and serialized.
 *
 * Uses its own short-lived high-concurrency pool so the burst is fast and does
 * not starve the app's shared connection pool.
 */

export interface StressResult {
  attempted: number
  uniqueKeys: number
  duplicateAttempts: number
  recorded: number
  doubleCounts: number
  conflictsRetried: number
  ms: number
  mode: "dsql" | "memory"
}

const CONCURRENCY = 20
const MAX_RETRIES = 6

function isRetryable(err: unknown): boolean {
  const e = err as { code?: string; message?: string }
  return e?.code === "40001" || /OC0\d\d|serializ|conflict|retry/i.test(e?.message ?? "")
}

async function mapLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0
  const worker = async () => {
    while (cursor < items.length) await fn(items[cursor++])
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

function buildAttempts(prefix: string, total: number, uniqueKeys: number): string[] {
  const keys = Array.from({ length: uniqueKeys }, (_, i) => `${prefix}${i}`)
  const attempts = [...keys]
  while (attempts.length < total) {
    attempts.push(keys[Math.floor(Math.random() * uniqueKeys)])
  }
  for (let i = attempts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[attempts[i], attempts[j]] = [attempts[j], attempts[i]]
  }
  return attempts
}

export async function runConsistencyTest(
  customerId: string,
  opts: { total?: number; uniqueRatio?: number } = {},
): Promise<StressResult> {
  const total = Math.min(Math.max(opts.total ?? 250, 10), 800)
  const uniqueRatio = Math.min(Math.max(opts.uniqueRatio ?? 0.6, 0.1), 1)
  const uniqueKeys = Math.max(1, Math.floor(total * uniqueRatio))

  const runId = randomUUID().slice(0, 8)
  const prefix = `stress-${customerId}-${runId}-`
  const attempts = buildAttempts(prefix, total, uniqueKeys)
  const eventTime = new Date()
  const start = Date.now()

  // In-memory fallback (preview / no cluster attached).
  if (!process.env.DSQL_ENDPOINT && !process.env.DATABASE_URL) {
    const store = memoryStore()
    const seen = new Set(store.events.map((e) => e.idempotencyKey))
    for (const key of attempts) {
      if (seen.has(key)) continue
      seen.add(key)
      store.events.push({
        id: randomUUID(),
        customerId,
        metric: "api_call",
        quantity: 1,
        eventTime: eventTime.toISOString(),
        idempotencyKey: key,
        createdAt: eventTime.toISOString(),
      })
    }
    const recorded = store.events.filter((e) => e.idempotencyKey.startsWith(prefix)).length
    return finalize(total, uniqueKeys, recorded, 0, Date.now() - start, "memory")
  }

  const pool = makePool()
  let conflictsRetried = 0
  try {
    await mapLimit(attempts, CONCURRENCY, async (idempotencyKey) => {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          await pool.query(
            `INSERT INTO usage_events (customer_id, metric, quantity, event_time, idempotency_key)
             VALUES ($1, 'api_call', 1, $2, $3)
             ON CONFLICT (idempotency_key) DO NOTHING`,
            [customerId, eventTime, idempotencyKey],
          )
          return
        } catch (err) {
          if (isRetryable(err) && attempt < MAX_RETRIES) {
            conflictsRetried++
            await new Promise((r) => setTimeout(r, 10 + Math.random() * 40))
            continue
          }
          throw err
        }
      }
    })

    const { rows } = await pool.query<{ c: number }>(
      `SELECT count(*)::int AS c FROM usage_events WHERE idempotency_key LIKE $1`,
      [prefix + "%"],
    )
    return finalize(total, uniqueKeys, rows[0].c, conflictsRetried, Date.now() - start, "dsql")
  } finally {
    await pool.end()
  }
}

function makePool(): pg.Pool {
  const endpoint = process.env.DSQL_ENDPOINT
  if (endpoint) {
    const signer = new DsqlSigner({
      hostname: endpoint,
      region: process.env.AWS_REGION ?? "us-east-1",
    })
    const user = process.env.DSQL_USER ?? "admin"
    return new pg.Pool({
      host: endpoint,
      port: 5432,
      user,
      database: process.env.DSQL_DATABASE ?? "postgres",
      password: () =>
        user === "admin"
          ? signer.getDbConnectAdminAuthToken()
          : signer.getDbConnectAuthToken(),
      ssl: { rejectUnauthorized: true },
      max: CONCURRENCY,
      maxLifetimeSeconds: 600,
    })
  }
  // DATABASE_URL fallback
  const connectionString = process.env.DATABASE_URL!
  return new pg.Pool({
    connectionString,
    ssl: connectionString.includes("sslmode=disable")
      ? false
      : { rejectUnauthorized: true, ca: process.env.DATABASE_CA_CERT },
    max: CONCURRENCY,
  })
}

function finalize(
  total: number,
  uniqueKeys: number,
  recorded: number,
  conflictsRetried: number,
  ms: number,
  mode: "dsql" | "memory",
): StressResult {
  return {
    attempted: total,
    uniqueKeys,
    duplicateAttempts: total - uniqueKeys,
    recorded,
    doubleCounts: recorded - uniqueKeys,
    conflictsRetried,
    ms,
    mode,
  }
}
