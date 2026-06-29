import { NextResponse } from "next/server"
import { SQSClient, GetQueueAttributesCommand } from "@aws-sdk/client-sqs"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { usageEvents } from "@/lib/db/schema"

export const dynamic = "force-dynamic"

/**
 * GET /api/health — live view of the ingest pipeline. Read-only, no auth.
 * Proves the buffered "never-dropped" path: events sit on SQS, then land in the
 * strongly-consistent DSQL ledger.
 */

const QUEUE_URL = process.env.SQS_QUEUE_URL
const sqs = QUEUE_URL
  ? new SQSClient({ region: process.env.AWS_REGION ?? "us-east-1" })
  : null

export async function GET() {
  let depth: number | null = null
  let inFlight: number | null = null
  if (sqs && QUEUE_URL) {
    try {
      const r = await sqs.send(
        new GetQueueAttributesCommand({
          QueueUrl: QUEUE_URL,
          AttributeNames: [
            "ApproximateNumberOfMessages",
            "ApproximateNumberOfMessagesNotVisible",
          ],
        }),
      )
      depth = Number(r.Attributes?.ApproximateNumberOfMessages ?? 0)
      inFlight = Number(r.Attributes?.ApproximateNumberOfMessagesNotVisible ?? 0)
    } catch {
      // leave nulls
    }
  }

  let totalEvents: number | null = null
  let eventsLastMinute: number | null = null
  if (db) {
    try {
      const [row] = await db
        .select({
          total: sql<number>`count(*)::int`,
          lastMinute: sql<number>`(count(*) FILTER (WHERE created_at > now() - interval '1 minute'))::int`,
        })
        .from(usageEvents)
      totalEvents = Number(row.total)
      eventsLastMinute = Number(row.lastMinute)
    } catch {
      // leave nulls
    }
  }

  return NextResponse.json({
    queue: { depth, inFlight, configured: !!sqs },
    ledger: { totalEvents, eventsLastMinute },
    ts: new Date().toISOString(),
  })
}
