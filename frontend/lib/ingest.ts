import { randomUUID } from "crypto"
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs"
import { db } from "./db/client"
import { usageEvents as usageEventsTable } from "./db/schema"
import { memoryStore } from "./memory-store"
import type { IngestEvent } from "./types"

export interface IngestResult {
  inserted: boolean
  duplicate: boolean
  buffered?: boolean
}

/**
 * ISOLATED INGEST HANDLER.
 *
 * Three modes, in precedence order:
 *
 *   1. SQS_QUEUE_URL set -> BUFFER the event on SQS and return immediately. A
 *      drainer Lambda performs the idempotent insert into DSQL. This is the real
 *      production path: a traffic spike or DB hiccup never drops a billable
 *      event. The route handler never changes — only this function does.
 *
 *   2. db available (DSQL/Postgres, no queue) -> idempotent insert directly
 *      (ON CONFLICT (idempotency_key) DO NOTHING).
 *
 *   3. neither -> in-memory store, for preview before any infra is attached.
 */

const QUEUE_URL = process.env.SQS_QUEUE_URL
const sqs = QUEUE_URL
  ? new SQSClient({ region: process.env.AWS_REGION ?? "us-east-1" })
  : null

export async function ingestUsageEvent(
  event: IngestEvent,
): Promise<IngestResult> {
  // Mode 1: buffer on SQS (never block the caller on a DB write).
  if (sqs && QUEUE_URL) {
    await sqs.send(
      new SendMessageCommand({
        QueueUrl: QUEUE_URL,
        MessageBody: JSON.stringify(event),
      }),
    )
    // Accepted + buffered; the drainer commits it to the ledger asynchronously.
    return { inserted: true, duplicate: false, buffered: true }
  }

  const eventTime = event.event_time ? new Date(event.event_time) : new Date()

  // Mode 3: in-memory fallback.
  if (!db) {
    const store = memoryStore()
    const exists = store.events.some(
      (e) => e.idempotencyKey === event.idempotency_key,
    )
    if (exists) return { inserted: false, duplicate: true }

    store.events.push({
      id: randomUUID(),
      customerId: event.customer_id,
      metric: event.metric,
      quantity: Number(event.quantity),
      eventTime: eventTime.toISOString(),
      idempotencyKey: event.idempotency_key,
      createdAt: new Date().toISOString(),
    })
    return { inserted: true, duplicate: false }
  }

  // Mode 2: direct idempotent insert.
  const result = await db
    .insert(usageEventsTable)
    .values({
      customerId: event.customer_id,
      metric: event.metric,
      quantity: String(event.quantity),
      eventTime,
      idempotencyKey: event.idempotency_key,
    })
    .onConflictDoNothing({ target: usageEventsTable.idempotencyKey })
    .returning({ id: usageEventsTable.id })

  const inserted = result.length > 0
  return { inserted, duplicate: !inserted }
}
