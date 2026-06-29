import {
  bigint,
  boolean,
  integer,
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
  // optional graduated volume tiers: [{ upToQty, unitPriceCents }]
  tiers: jsonb("tiers"),
})

export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: uuid("id").primaryKey().defaultRandom(),
  url: text("url").notNull(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  endpointId: uuid("endpoint_id").notNull(),
  eventType: text("event_type").notNull(),
  status: text("status").notNull(),
  statusCode: integer("status_code"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const plans = pgTable("plans", {
  name: text("name").primaryKey(),
  baseFeeCents: bigint("base_fee_cents", { mode: "number" }).notNull(),
  included: jsonb("included").notNull(),
  minimumCents: bigint("minimum_cents", { mode: "number" }),
})

export const creditGrants = pgTable("credit_grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").notNull(),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
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
