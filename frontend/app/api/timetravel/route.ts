import { NextResponse } from "next/server"
import { loadSnapshot } from "@/lib/repository"
import { buildCustomerSummaries } from "@/lib/billing"

export const dynamic = "force-dynamic"

/**
 * GET /api/timetravel?at=<ISO> — recompute every customer's meter AS OF a past
 * instant, by re-pricing only the events with event_time <= at. The append-only,
 * strongly-consistent DSQL ledger makes point-in-time totals exact.
 */
export async function GET(request: Request) {
  const at = new URL(request.url).searchParams.get("at")
  const cutoff = at ? new Date(at) : new Date()
  const cutoffMs = cutoff.getTime()

  const { customers, events, pricing } = await loadSnapshot()
  const upTo = events.filter((e) => new Date(e.eventTime).getTime() <= cutoffMs)

  const summaries = buildCustomerSummaries(customers, upTo, pricing)
  const rows = summaries.map((s) => ({
    id: s.id,
    name: s.name,
    cents: s.runningTotalCents,
  }))
  const totalCents = rows.reduce((sum, r) => sum + r.cents, 0)

  return NextResponse.json({
    at: cutoff.toISOString(),
    totalCents,
    eventCount: upTo.length,
    rows,
  })
}
