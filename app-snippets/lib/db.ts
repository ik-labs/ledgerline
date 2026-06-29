// Aurora DSQL connection layer.
//
// THE ONE REAL DSQL GOTCHA: the database "password" is not static — it's a
// short-lived IAM auth token (~15 min) minted from AWS credentials. We pass
// `password` as an async function so node-postgres mints a FRESH token every
// time the pool opens a new physical connection. Everything else is vanilla
// Postgres.
//
// Required env (see .env.example):
//   DSQL_ENDPOINT, DSQL_DATABASE, DSQL_USER, AWS_REGION,
//   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
//
// Deps to add in the v0 project:  npm i pg @aws-sdk/dsql-signer
//                                 npm i -D @types/pg

import { Pool, type PoolClient } from "pg";
import { DsqlSigner } from "@aws-sdk/dsql-signer";

const endpoint = process.env.DSQL_ENDPOINT!;
const region = process.env.AWS_REGION ?? "us-east-1";
const user = process.env.DSQL_USER ?? "admin";
const database = process.env.DSQL_DATABASE ?? "postgres";

if (!endpoint) {
  throw new Error("DSQL_ENDPOINT is not set");
}

const signer = new DsqlSigner({ hostname: endpoint, region });

// admin role uses the admin token; any other role uses the standard token.
async function mintToken(): Promise<string> {
  return user === "admin"
    ? signer.getDbConnectAdminAuthToken()
    : signer.getDbConnectAuthToken();
}

// Reuse a single pool across hot-reloaded module instances in dev / warm
// serverless containers in prod.
const globalForDb = globalThis as unknown as { __ledgerlinePool?: Pool };

export const pool: Pool =
  globalForDb.__ledgerlinePool ??
  new Pool({
    host: endpoint,
    port: 5432,
    user,
    database,
    // node-postgres accepts an async password provider — fresh token per connection.
    password: mintToken,
    ssl: { rejectUnauthorized: true },
    max: 5,
    idleTimeoutMillis: 30_000,
    // close idle connections before the IAM token would expire
    maxLifetimeSeconds: 600,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__ledgerlinePool = pool;
}

/** Run a parameterized query and return rows. */
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await pool.query(text, params as never[]);
  return res.rows as T[];
}

/** Borrow a client for a multi-statement transaction. */
export async function withClient<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
