import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { DsqlSigner } from "@aws-sdk/dsql-signer"
import * as schema from "./schema"

/**
 * Isolated database connection layer.
 *
 * This is the ONE place that knows how we connect to Postgres.
 *
 * THE DSQL GOTCHA: Aurora DSQL is wire-compatible with Postgres, but the
 * "password" is not static — it's a short-lived IAM auth token (~15 min) minted
 * from AWS credentials. We pass `password` as an async function so node-postgres
 * mints a FRESH token every time the pool opens a new physical connection.
 *
 * Connection precedence:
 *   1. DSQL_ENDPOINT set  -> Aurora DSQL with IAM-token auth
 *   2. DATABASE_URL set   -> plain Postgres (any managed provider)
 *   3. neither            -> db is null; the app falls back to an in-memory
 *                            store (see lib/repository.ts) so the dashboard is
 *                            fully demoable before a real cluster is attached.
 */

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>

declare global {
  // eslint-disable-next-line no-var
  var __ledgerlinePool: Pool | undefined
  // eslint-disable-next-line no-var
  var __ledgerlineDb: DrizzleDb | null | undefined
}

function createDsqlPool(): Pool {
  const endpoint = process.env.DSQL_ENDPOINT!
  const region = process.env.AWS_REGION ?? "us-east-1"
  const user = process.env.DSQL_USER ?? "admin"
  const database = process.env.DSQL_DATABASE ?? "postgres"

  const signer = new DsqlSigner({ hostname: endpoint, region })
  const mintToken = () =>
    user === "admin"
      ? signer.getDbConnectAdminAuthToken()
      : signer.getDbConnectAuthToken()

  return new Pool({
    host: endpoint,
    port: 5432,
    user,
    database,
    password: mintToken,
    ssl: { rejectUnauthorized: true },
    max: 5,
    idleTimeoutMillis: 30_000,
    // Recycle connections before the IAM token expires.
    maxLifetimeSeconds: 600,
  })
}

function createDb(): DrizzleDb | null {
  let pool = global.__ledgerlinePool

  if (!pool) {
    if (process.env.DSQL_ENDPOINT) {
      pool = createDsqlPool()
    } else if (process.env.DATABASE_URL) {
      const connectionString = process.env.DATABASE_URL
      // Verify TLS by default. Local/dev can opt out with sslmode=disable; a
      // provider with a private CA can supply it via DATABASE_CA_CERT.
      pool = new Pool({
        connectionString,
        ssl: connectionString.includes("sslmode=disable")
          ? false
          : { rejectUnauthorized: true, ca: process.env.DATABASE_CA_CERT },
        max: 5,
      })
    } else {
      return null
    }
  }

  if (process.env.NODE_ENV !== "production") {
    global.__ledgerlinePool = pool
  }

  return drizzle(pool, { schema })
}

export const db: DrizzleDb | null =
  global.__ledgerlineDb !== undefined ? global.__ledgerlineDb : createDb()

if (process.env.NODE_ENV !== "production") {
  global.__ledgerlineDb = db
}

export const isDatabaseConnected = db !== null
export { schema }
