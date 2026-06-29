import {
  bigint,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

/**
 * PostgreSQL schema for Ledgerline.
 *
 * Aurora DSQL is PostgreSQL-compatible, so this schema maps directly onto a
 * DSQL cluster. Money is always stored in integer cents (bigint) and only
 * formatted to currency in the UI.
 */

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  plan: text("plan").notNull(),
  spendThresholdCents: bigint("spend_threshold_cents", {
    mode: "number",
  }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const usageEvents = pgTable("usage_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").notNull(),
  metric: text("metric").notNull(),
  quantity: numeric("quantity").notNull(),
  eventTime: timestamp("event_time", { withTimezone: true }).notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const pricing = pgTable("pricing", {
  metric: text("metric").primaryKey(),
  unitPriceCents: bigint("unit_price_cents", { mode: "number" }).notNull(),
})

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").notNull(),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  totalCents: bigint("total_cents", { mode: "number" }).notNull(),
  lineItems: jsonb("line_items").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})
