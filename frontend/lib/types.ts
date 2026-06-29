export type CustomerStatus = "ok" | "approaching" | "over"

export interface Customer {
  id: string
  name: string
  plan: string
  spendThresholdCents: number
  createdAt: string
}

export interface UsageEvent {
  id: string
  customerId: string
  metric: string
  quantity: number
  eventTime: string
  idempotencyKey: string
  createdAt: string
}

export interface PricingTier {
  upToQty: number | null // upper bound of this band (null = unbounded)
  unitPriceCents: number
}

export interface PricingRate {
  metric: string
  unitPriceCents: number
  tiers?: PricingTier[] | null // graduated volume pricing; when set, overrides flat
}

export interface MetricBreakdown {
  metric: string
  quantity: number
  unitPriceCents: number // effective (blended) rate when tiered
  subtotalCents: number
  tiered?: boolean
}

export interface CustomerSummary {
  id: string
  name: string
  plan: string
  spendThresholdCents: number
  runningTotalCents: number
  status: CustomerStatus
}

export interface DailyPoint {
  date: string // YYYY-MM-DD
  cents: number // cumulative spend through this day in the cycle
}

export interface CreditGrant {
  id: string
  customerId: string
  amountCents: number
  note: string | null
  createdAt: string
}

export interface PrepaidBalance {
  grantedCents: number
  usedCents: number
  remainingCents: number
}

export interface CustomerUsage {
  customer: Customer
  runningTotalCents: number
  status: CustomerStatus
  breakdown: MetricBreakdown[]
  recentEvents: Array<UsageEvent & { unitPriceCents: number; subtotalCents: number }>
  dailySeries: DailyPoint[]
  projectedCents: number // forecast end-of-cycle spend from current run-rate
  cycleProgress: number // fraction of the cycle elapsed (0..1)
  prepaid: PrepaidBalance | null // prepaid credit drawdown, when granted
}

export interface InvoiceLineItem {
  metric: string
  quantity: number
  unitPriceCents: number
  subtotalCents: number
  tiered?: boolean
}

export interface Invoice {
  id: string
  customerId: string
  customerName: string
  periodStart: string
  periodEnd: string
  totalCents: number
  lineItems: InvoiceLineItem[]
  status: "draft" | "issued"
  createdAt: string
}

export interface IngestEvent {
  customer_id: string
  metric: string
  quantity: number
  event_time: string
  idempotency_key: string
}
