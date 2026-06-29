import type {
  Customer,
  CustomerStatus,
  CustomerSummary,
  CustomerUsage,
  Invoice,
  InvoiceLineItem,
  MetricBreakdown,
  PricingRate,
  UsageEvent,
} from "./types"

/** The current monthly billing cycle [start, end). */
export function getCurrentCycle(now = new Date()): {
  start: Date
  end: Date
} {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  )
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  )
  return { start, end }
}

function priceMap(pricing: PricingRate[]): Map<string, number> {
  return new Map(pricing.map((p) => [p.metric, p.unitPriceCents]))
}

function statusFor(total: number, threshold: number): CustomerStatus {
  if (threshold <= 0) return "ok"
  if (total >= threshold) return "over"
  if (total >= threshold * 0.8) return "approaching"
  return "ok"
}

function eventsInCycle(events: UsageEvent[], now = new Date()): UsageEvent[] {
  const { start, end } = getCurrentCycle(now)
  return events.filter((e) => {
    const t = new Date(e.eventTime).getTime()
    return t >= start.getTime() && t < end.getTime()
  })
}

/** Aggregate per-metric breakdown for a set of events. */
export function buildBreakdown(
  events: UsageEvent[],
  pricing: PricingRate[],
): MetricBreakdown[] {
  const prices = priceMap(pricing)
  const byMetric = new Map<string, number>()
  for (const e of events) {
    byMetric.set(e.metric, (byMetric.get(e.metric) ?? 0) + Number(e.quantity))
  }
  return Array.from(byMetric.entries())
    .map(([metric, quantity]) => {
      const unitPriceCents = prices.get(metric) ?? 0
      return {
        metric,
        quantity,
        unitPriceCents,
        subtotalCents: Math.round(quantity * unitPriceCents),
      }
    })
    .sort((a, b) => b.subtotalCents - a.subtotalCents)
}

export function totalCents(breakdown: { subtotalCents: number }[]): number {
  return breakdown.reduce((sum, b) => sum + b.subtotalCents, 0)
}

export function buildCustomerSummaries(
  customers: Customer[],
  events: UsageEvent[],
  pricing: PricingRate[],
  now = new Date(),
): CustomerSummary[] {
  const cycleEvents = eventsInCycle(events, now)
  return customers
    .map((c) => {
      const breakdown = buildBreakdown(
        cycleEvents.filter((e) => e.customerId === c.id),
        pricing,
      )
      const runningTotalCents = totalCents(breakdown)
      return {
        id: c.id,
        name: c.name,
        plan: c.plan,
        spendThresholdCents: c.spendThresholdCents,
        runningTotalCents,
        status: statusFor(runningTotalCents, c.spendThresholdCents),
      }
    })
    .sort((a, b) => b.runningTotalCents - a.runningTotalCents)
}

export function buildCustomerUsage(
  customer: Customer,
  events: UsageEvent[],
  pricing: PricingRate[],
  recentLimit = 25,
  now = new Date(),
): CustomerUsage {
  const prices = priceMap(pricing)
  const customerEvents = events.filter((e) => e.customerId === customer.id)
  const cycleEvents = eventsInCycle(customerEvents, now)
  const breakdown = buildBreakdown(cycleEvents, pricing)
  const runningTotalCents = totalCents(breakdown)

  const recentEvents = [...customerEvents]
    .sort(
      (a, b) =>
        new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime(),
    )
    .slice(0, recentLimit)
    .map((e) => {
      const unitPriceCents = prices.get(e.metric) ?? 0
      return {
        ...e,
        unitPriceCents,
        subtotalCents: Math.round(Number(e.quantity) * unitPriceCents),
      }
    })

  return {
    customer,
    runningTotalCents,
    status: statusFor(runningTotalCents, customer.spendThresholdCents),
    breakdown,
    recentEvents,
  }
}

/** Build invoice line items + total for a customer's cycle. */
export function buildInvoiceForCustomer(
  customer: Customer,
  events: UsageEvent[],
  pricing: PricingRate[],
  now = new Date(),
): { lineItems: InvoiceLineItem[]; totalCents: number } {
  const cycleEvents = eventsInCycle(
    events.filter((e) => e.customerId === customer.id),
    now,
  )
  const lineItems = buildBreakdown(cycleEvents, pricing)
  return { lineItems, totalCents: totalCents(lineItems) }
}

export function attachCustomerNames(
  invoices: Invoice[],
  customers: Customer[],
): Invoice[] {
  const names = new Map(customers.map((c) => [c.id, c.name]))
  return invoices.map((inv) => ({
    ...inv,
    customerName: names.get(inv.customerId) ?? inv.customerName ?? "Unknown",
  }))
}
