import { db } from "./db/client"
import {
  customers as customersTable,
  invoices as invoicesTable,
  pricing as pricingTable,
  usageEvents as usageEventsTable,
} from "./db/schema"
import { memoryStore } from "./memory-store"
import {
  attachCustomerNames,
  buildCustomerSummaries,
  buildCustomerUsage,
} from "./billing"
import { slugify } from "./slug"
import type {
  Customer,
  CustomerSummary,
  CustomerUsage,
  Invoice,
  InvoiceLineItem,
  PricingRate,
  UsageEvent,
} from "./types"

export interface Snapshot {
  customers: Customer[]
  pricing: PricingRate[]
  events: UsageEvent[]
  invoices: Invoice[]
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

/**
 * Load the working set of data. Reads from Postgres when DATABASE_URL is
 * configured, otherwise falls back to the in-memory store for preview.
 */
export async function loadSnapshot(): Promise<Snapshot> {
  if (!db) {
    const s = memoryStore()
    return {
      customers: s.customers,
      pricing: s.pricing,
      events: s.events,
      invoices: s.invoices,
    }
  }

  const [customerRows, pricingRows, eventRows, invoiceRows] = await Promise.all([
    db.select().from(customersTable),
    db.select().from(pricingTable),
    db.select().from(usageEventsTable),
    db.select().from(invoicesTable),
  ])

  const customers: Customer[] = customerRows.map((c) => ({
    id: c.id,
    name: c.name,
    plan: c.plan,
    spendThresholdCents: Number(c.spendThresholdCents),
    createdAt: iso(c.createdAt),
  }))

  const pricing: PricingRate[] = pricingRows.map((p) => ({
    metric: p.metric,
    unitPriceCents: Number(p.unitPriceCents),
    tiers: (p.tiers as PricingRate["tiers"]) ?? null,
  }))

  const events: UsageEvent[] = eventRows.map((e) => ({
    id: e.id,
    customerId: e.customerId,
    metric: e.metric,
    quantity: Number(e.quantity),
    eventTime: iso(e.eventTime),
    idempotencyKey: e.idempotencyKey,
    createdAt: iso(e.createdAt),
  }))

  const invoices: Invoice[] = invoiceRows.map((inv) => ({
    id: inv.id,
    customerId: inv.customerId,
    customerName: "",
    periodStart: iso(inv.periodStart),
    periodEnd: iso(inv.periodEnd),
    totalCents: Number(inv.totalCents),
    lineItems: inv.lineItems as InvoiceLineItem[],
    status: inv.status as Invoice["status"],
    createdAt: iso(inv.createdAt),
  }))

  return { customers, pricing, events, invoices }
}

export async function getCustomerSummaries(): Promise<CustomerSummary[]> {
  const { customers, events, pricing } = await loadSnapshot()
  return buildCustomerSummaries(customers, events, pricing)
}

export async function getCustomerUsage(
  customerId: string,
): Promise<CustomerUsage | null> {
  const { customers, events, pricing } = await loadSnapshot()
  const customer = customers.find((c) => c.id === customerId)
  if (!customer) return null
  return buildCustomerUsage(customer, events, pricing)
}

export async function getCustomerById(
  customerId: string,
): Promise<Customer | null> {
  const { customers } = await loadSnapshot()
  return customers.find((c) => c.id === customerId) ?? null
}

/** Full append-only event log for a customer, newest first (for the audit trail). */
export async function getCustomerEvents(
  customerId: string,
  limit = 200,
): Promise<UsageEvent[]> {
  const { events } = await loadSnapshot()
  return events
    .filter((e) => e.customerId === customerId)
    .sort(
      (a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime(),
    )
    .slice(0, limit)
}

/** Resolve a route param that may be a UUID or a name-slug into usage data. */
export async function getCustomerUsageByParam(
  param: string,
): Promise<CustomerUsage | null> {
  const { customers, events, pricing } = await loadSnapshot()
  const customer = customers.find(
    (c) => c.id === param || slugify(c.name) === param,
  )
  if (!customer) return null
  return buildCustomerUsage(customer, events, pricing)
}

export async function getInvoices(): Promise<Invoice[]> {
  const { invoices, customers } = await loadSnapshot()
  return attachCustomerNames(invoices, customers).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}
