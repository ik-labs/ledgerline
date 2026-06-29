import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { ingestUsageEvent } from "@/lib/ingest"
import { checkWriteAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

const METRICS = ["api_call", "gb_stored", "seat", "compute_ms", "egress_gb"]

/**
 * Demo-only: generate a burst of usage events for an existing customer, server
 * side, and push them through the same ingest path (-> SQS -> drainer -> DSQL).
 *
 * Runs on the server so the browser "Simulate" button never holds the ingest
 * secret. Takes no arbitrary ledger input — only a customerId — so a same-origin
 * guard is sufficient.
 */
export async function POST(request: Request) {
  const denied = checkWriteAuth(request)
  if (denied) return denied

  let customerId: string | undefined
  try {
    customerId = (await request.json())?.customerId
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  if (!customerId) {
    return NextResponse.json({ error: "customerId is required" }, { status: 400 })
  }

  const count = 5 + Math.floor(Math.random() * 6) // 5-10
  const now = Date.now()

  for (let i = 0; i < count; i++) {
    const metric = METRICS[Math.floor(Math.random() * METRICS.length)]
    const quantity =
      metric === "seat"
        ? 1 + Math.floor(Math.random() * 3)
        : Math.round((10 + Math.random() * 900) * 100) / 100
    await ingestUsageEvent({
      customer_id: customerId,
      metric,
      quantity,
      event_time: new Date().toISOString(),
      idempotency_key: `sim-${customerId}-${now}-${i}-${randomUUID().slice(0, 8)}`,
    })
  }

  return NextResponse.json({ ok: true, count }, { status: 202 })
}
