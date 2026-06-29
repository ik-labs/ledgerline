import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { ingestUsageEvent } from "@/lib/ingest"
import type { IngestEvent } from "@/lib/types"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  let body: Partial<IngestEvent>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { customer_id, metric, quantity } = body
  if (!customer_id || !metric || quantity === undefined || quantity === null) {
    return NextResponse.json(
      { error: "customer_id, metric, and quantity are required" },
      { status: 400 },
    )
  }

  const event: IngestEvent = {
    customer_id,
    metric,
    quantity: Number(quantity),
    event_time: body.event_time ?? new Date().toISOString(),
    idempotency_key: body.idempotency_key ?? randomUUID(),
  }

  try {
    const result = await ingestUsageEvent(event)
    return NextResponse.json(
      { ok: true, ...result },
      { status: result.inserted ? 201 : 200 },
    )
  } catch (error) {
    console.error("[v0] ingest error:", error)
    return NextResponse.json(
      { error: "Failed to ingest usage event" },
      { status: 500 },
    )
  }
}
