import { randomUUID } from "crypto"
import { and, eq } from "drizzle-orm"
import { db } from "./db/client"
import { invoices as invoicesTable } from "./db/schema"
import { memoryStore } from "./memory-store"
import { buildInvoiceForCustomer, getCurrentCycle } from "./billing"
import { loadSnapshot } from "./repository"
import type { Invoice } from "./types"

/**
 * Roll up the current cycle's usage_events into one invoice per customer.
 *
 * Upserts on (customer_id, period) so re-running does NOT create duplicates.
 * In production this same logic also runs on an EventBridge schedule.
 */
export async function runRollup(): Promise<Invoice[]> {
  const { customers, events, pricing } = await loadSnapshot()
  const { start, end } = getCurrentCycle()
  const periodStart = start.toISOString()
  const periodEnd = end.toISOString()

  const created: Invoice[] = []

  for (const customer of customers) {
    const { lineItems, totalCents } = buildInvoiceForCustomer(
      customer,
      events,
      pricing,
    )
    if (lineItems.length === 0) continue

    const invoice: Invoice = {
      id: randomUUID(),
      customerId: customer.id,
      customerName: customer.name,
      periodStart,
      periodEnd,
      totalCents,
      lineItems,
      status: "draft",
      createdAt: new Date().toISOString(),
    }

    if (!db) {
      const store = memoryStore()
      const existing = store.invoices.find(
        (inv) =>
          inv.customerId === customer.id &&
          inv.periodStart === periodStart &&
          inv.periodEnd === periodEnd,
      )
      if (existing) {
        existing.totalCents = totalCents
        existing.lineItems = lineItems
        existing.createdAt = invoice.createdAt
        created.push(existing)
      } else {
        store.invoices.push(invoice)
        created.push(invoice)
      }
      continue
    }

    const existing = await db
      .select()
      .from(invoicesTable)
      .where(
        and(
          eq(invoicesTable.customerId, customer.id),
          eq(invoicesTable.periodStart, start),
        ),
      )
      .limit(1)

    if (existing.length > 0) {
      await db
        .update(invoicesTable)
        .set({ totalCents, lineItems })
        .where(eq(invoicesTable.id, existing[0].id))
      created.push({ ...invoice, id: existing[0].id })
    } else {
      const [row] = await db
        .insert(invoicesTable)
        .values({
          customerId: customer.id,
          periodStart: start,
          periodEnd: end,
          totalCents,
          lineItems,
          status: "draft",
        })
        .returning({ id: invoicesTable.id })
      created.push({ ...invoice, id: row.id })
    }
  }

  return created.sort((a, b) => b.totalCents - a.totalCents)
}
