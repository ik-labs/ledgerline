import { randomUUID } from "crypto"
import { getCurrentCycle } from "./billing"
import type {
  CreditGrant,
  Customer,
  Invoice,
  Plan,
  PricingRate,
  UsageEvent,
} from "./types"

const PLANS: Plan[] = [
  { name: "Starter", baseFeeCents: 0, included: { api_call: 2000, gb_stored: 50 } },
  {
    name: "Growth",
    baseFeeCents: 4900,
    included: { api_call: 10000, gb_stored: 200, compute_ms: 50000, egress_gb: 50, seat: 3 },
  },
  {
    name: "Scale",
    baseFeeCents: 9900,
    included: { api_call: 50000, gb_stored: 1000, compute_ms: 200000, egress_gb: 200, seat: 10 },
  },
]

/**
 * In-memory data store used ONLY when DATABASE_URL is not configured. It lets
 * the dashboard run fully (ingest, live meter, roll-up) in preview before a
 * real Postgres / Aurora DSQL cluster is attached. Seeded to mirror the SQL
 * seed snippet in lib/db/seed.sql.
 */

interface Store {
  customers: Customer[]
  pricing: PricingRate[]
  events: UsageEvent[]
  invoices: Invoice[]
  grants: CreditGrant[]
  plans: Plan[]
}

const PRICING: PricingRate[] = [
  {
    metric: "api_call",
    unitPriceCents: 2,
    // volume pricing: first 5,000 calls at 2c, beyond at 1c
    tiers: [
      { upToQty: 5000, unitPriceCents: 2 },
      { upToQty: null, unitPriceCents: 1 },
    ],
  },
  { metric: "gb_stored", unitPriceCents: 12 },
  { metric: "seat", unitPriceCents: 1500 },
  { metric: "compute_ms", unitPriceCents: 1 },
  { metric: "egress_gb", unitPriceCents: 9 },
  { metric: "credit", unitPriceCents: 1 },
]

// Stable UUIDs so links are predictable across reloads in preview.
const C1 = "11111111-1111-4111-8111-111111111111"
const C2 = "22222222-2222-4222-8222-222222222222"
const C3 = "33333333-3333-4333-8333-333333333333"

const CUSTOMERS: Customer[] = [
  {
    id: C1,
    name: "Northwind Logistics",
    plan: "Scale",
    spendThresholdCents: 500_00,
    createdAt: new Date("2024-11-02T10:00:00Z").toISOString(),
  },
  {
    id: C2,
    name: "Helios Robotics",
    plan: "Growth",
    spendThresholdCents: 250_00,
    createdAt: new Date("2025-01-14T10:00:00Z").toISOString(),
  },
  {
    id: C3,
    name: "Atlas Mapping Co.",
    plan: "Starter",
    spendThresholdCents: 100_00,
    createdAt: new Date("2025-03-21T10:00:00Z").toISOString(),
  },
]

function seedEvents(): UsageEvent[] {
  const { start } = getCurrentCycle()
  const now = Date.now()
  const span = now - start.getTime()
  const events: UsageEvent[] = []

  const plans: Array<{
    customerId: string
    metric: string
    count: number
    qtyRange: [number, number]
  }> = [
    { customerId: C1, metric: "api_call", count: 40, qtyRange: [200, 1200] },
    { customerId: C1, metric: "gb_stored", count: 8, qtyRange: [50, 220] },
    { customerId: C1, metric: "seat", count: 3, qtyRange: [1, 4] },
    { customerId: C2, metric: "api_call", count: 26, qtyRange: [100, 600] },
    { customerId: C2, metric: "compute_ms", count: 14, qtyRange: [500, 5000] },
    { customerId: C2, metric: "egress_gb", count: 6, qtyRange: [5, 40] },
    { customerId: C3, metric: "api_call", count: 12, qtyRange: [50, 300] },
    { customerId: C3, metric: "gb_stored", count: 4, qtyRange: [10, 60] },
  ]

  for (const p of plans) {
    for (let i = 0; i < p.count; i++) {
      const t = start.getTime() + Math.random() * span
      const qty =
        Math.round(
          (p.qtyRange[0] + Math.random() * (p.qtyRange[1] - p.qtyRange[0])) *
            100,
        ) / 100
      events.push({
        id: randomUUID(),
        customerId: p.customerId,
        metric: p.metric,
        quantity: qty,
        eventTime: new Date(t).toISOString(),
        idempotencyKey: `seed-${randomUUID()}`,
        createdAt: new Date(t).toISOString(),
      })
    }
  }
  return events.sort(
    (a, b) =>
      new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime(),
  )
}

// Persist across hot reloads in dev via globalThis.
declare global {
  // eslint-disable-next-line no-var
  var __ledgerlineStore: Store | undefined
}

function init(): Store {
  return {
    customers: CUSTOMERS,
    pricing: PRICING,
    events: seedEvents(),
    invoices: [],
    grants: [{ id: randomUUID(), customerId: C1, amountCents: 100_000, note: "Initial commitment", createdAt: new Date().toISOString() }],
    plans: PLANS,
  }
}

export function memoryStore(): Store {
  if (!global.__ledgerlineStore) {
    global.__ledgerlineStore = init()
  }
  return global.__ledgerlineStore
}
