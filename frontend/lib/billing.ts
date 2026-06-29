import type {
  Customer,
  CustomerStatus,
  CustomerSummary,
  CustomerUsage,
  DailyPoint,
  Invoice,
  InvoiceLineItem,
  MetricBreakdown,
  PricingRate,
  UsageEvent,
} from "./types"

const DAY_MS = 86_400_000

/** Cycle elapsed/total days and the run-rate forecast for end-of-cycle spend. */
export function forecast(
  runningTotalCents: number,
  now = new Date(),
): { projectedCents: number; cycleProgress: number } {
  const { start, end } = getCurrentCycle(now)
  const daysInCycle = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS))
  const daysElapsed = Math.min(
    daysInCycle,
    Math.max(1, Math.ceil((now.getTime() - start.getTime()) / DAY_MS)),
  )
  const rate = runningTotalCents / daysElapsed
  return {
    projectedCents: Math.round(rate * daysInCycle),
    cycleProgress: daysElapsed / daysInCycle,
  }
}

/**
 * Cumulative spend per day across the current cycle (for the trend chart).
 * Computed by re-pricing all events up to each day's end with buildBreakdown, so
 * the curve is graduated-pricing-correct and its final point equals the meter.
 */
export function buildDailySeries(
  events: UsageEvent[],
  pricing: PricingRate[],
  now = new Date(),
): DailyPoint[] {
  const { start, end } = getCurrentCycle(now)
  const lastDay = Math.min(now.getTime(), end.getTime() - 1)
  const days = Math.max(1, Math.floor((lastDay - start.getTime()) / DAY_MS) + 1)

  const cycleEvents = events.filter((e) => {
    const t = new Date(e.eventTime).getTime()
    return t >= start.getTime() && t < end.getTime()
  })

  return Array.from({ length: days }, (_, i) => {
    const dayEnd = start.getTime() + (i + 1) * DAY_MS
    const upto = cycleEvents.filter(
      (e) => new Date(e.eventTime).getTime() < dayEnd,
    )
    return {
      date: new Date(start.getTime() + i * DAY_MS).toISOString().slice(0, 10),
      cents: totalCents(buildBreakdown(upto, pricing)),
    }
  })
}

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

function priceMap(pricing: PricingRate[]): Map<string, PricingRate> {
  return new Map(pricing.map((p) => [p.metric, p]))
}

/** Graduated cost for a quantity across volume tiers. */
export function gradCost(qty: number, tiers: PricingRate["tiers"]): number {
  if (!tiers || tiers.length === 0) return 0
  let lower = 0
  let cost = 0
  for (const t of tiers) {
    const upper = t.upToQty ?? Infinity
    const band = Math.min(qty, upper) - lower
    if (band > 0) cost += band * t.unitPriceCents
    lower = upper
    if (qty <= upper) break
  }
  return Math.round(cost)
}

/** Cost for `quantity` of `metric` — graduated if tiers are set, else flat. */
function costFor(rate: PricingRate | undefined, quantity: number): number {
  if (!rate) return 0
  if (rate.tiers && rate.tiers.length > 0 && quantity > 0) {
    return gradCost(quantity, rate.tiers)
  }
  return Math.round(quantity * rate.unitPriceCents)
}

function statusFor(total: number, threshold: number): CustomerStatus {
  if (threshold <= 0) return "ok"
  if (total >= threshold) return "over"
  if (total >= threshold * 0.8) return "approaching"
  return "ok"
}

export function eventsInCycle(events: UsageEvent[], now = new Date()): UsageEvent[] {
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
  const rates = priceMap(pricing)
  const byMetric = new Map<string, number>()
  for (const e of events) {
    byMetric.set(e.metric, (byMetric.get(e.metric) ?? 0) + Number(e.quantity))
  }
  return Array.from(byMetric.entries())
    .map(([metric, quantity]) => {
      const rate = rates.get(metric)
      const tiered = !!(rate?.tiers && rate.tiers.length > 0)
      const subtotalCents = costFor(rate, quantity)
      // effective (blended) unit rate when tiered, else the flat rate
      const unitPriceCents =
        tiered && quantity !== 0
          ? Math.round(subtotalCents / quantity)
          : rate?.unitPriceCents ?? 0
      return { metric, quantity, unitPriceCents, subtotalCents, tiered }
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
  const rates = priceMap(pricing)
  const customerEvents = events.filter((e) => e.customerId === customer.id)
  const cycleEvents = eventsInCycle(customerEvents, now)
  const breakdown = buildBreakdown(cycleEvents, pricing)
  const runningTotalCents = totalCents(breakdown)
  // per-event display rate: effective (blended) rate from the breakdown when set
  const effRate = new Map(breakdown.map((b) => [b.metric, b.unitPriceCents]))

  const recentEvents = [...customerEvents]
    .sort(
      (a, b) =>
        new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime(),
    )
    .slice(0, recentLimit)
    .map((e) => {
      const unitPriceCents =
        effRate.get(e.metric) ?? rates.get(e.metric)?.unitPriceCents ?? 0
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
    dailySeries: buildDailySeries(cycleEvents, pricing, now),
    ...forecast(runningTotalCents, now),
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
