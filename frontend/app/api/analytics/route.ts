import { NextResponse } from "next/server"
import { loadSnapshot } from "@/lib/repository"
import {
  buildBreakdown,
  buildCustomerSummaries,
  eventsInCycle,
  forecast,
} from "@/lib/billing"

export const dynamic = "force-dynamic"

/** GET /api/analytics — aggregate revenue analytics for the current cycle. */
export async function GET() {
  const { customers, events, pricing } = await loadSnapshot()

  const summaries = buildCustomerSummaries(customers, events, pricing)
  const totalRevenueCents = summaries.reduce(
    (s, c) => s + c.runningTotalCents,
    0,
  )
  const projectedCents = summaries.reduce(
    (s, c) => s + forecast(c.runningTotalCents).projectedCents,
    0,
  )

  const cycleEvents = eventsInCycle(events)

  // Revenue by metric = SUM of per-customer graduated subtotals (tiers are
  // per-customer, so we can't price the global quantity in one shot).
  const byMetricMap = new Map<string, number>()
  for (const c of customers) {
    const bd = buildBreakdown(
      cycleEvents.filter((e) => e.customerId === c.id),
      pricing,
    )
    for (const b of bd) {
      byMetricMap.set(b.metric, (byMetricMap.get(b.metric) ?? 0) + b.subtotalCents)
    }
  }
  const revenueByMetric = [...byMetricMap.entries()]
    .filter(([metric, cents]) => metric !== "credit" && cents > 0)
    .map(([metric, cents]) => ({ metric, cents }))
    .sort((a, b) => b.cents - a.cents)

  return NextResponse.json({
    totalRevenueCents,
    projectedCents,
    customerCount: customers.length,
    overLimit: summaries.filter((c) => c.status === "over").length,
    eventCount: cycleEvents.length,
    avgRevenuePerCustomerCents: customers.length
      ? Math.round(totalRevenueCents / customers.length)
      : 0,
    revenueByMetric,
    topCustomers: summaries.slice(0, 8).map((c) => ({
      id: c.id,
      name: c.name,
      cents: c.runningTotalCents,
      status: c.status,
    })),
  })
}
