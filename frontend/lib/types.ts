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

export interface PricingRate {
  metric: string
  unitPriceCents: number
}

export interface MetricBreakdown {
  metric: string
  quantity: number
  unitPriceCents: number
  subtotalCents: number
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

export interface CustomerUsage {
  customer: Customer
  runningTotalCents: number
  status: CustomerStatus
  breakdown: MetricBreakdown[]
  recentEvents: Array<UsageEvent & { unitPriceCents: number; subtotalCents: number }>
  dailySeries: DailyPoint[]
}

export interface InvoiceLineItem {
  metric: string
  quantity: number
  unitPriceCents: number
  subtotalCents: number
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
