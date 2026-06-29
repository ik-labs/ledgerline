import { desc, eq } from "drizzle-orm"
import { db } from "./db/client"
import { webhookDeliveries, webhookEndpoints } from "./db/schema"

export interface WebhookEndpoint {
  id: string
  url: string
  description: string | null
  active: boolean
  createdAt: string
}

export interface WebhookDelivery {
  id: string
  eventType: string
  status: string
  statusCode: number | null
  url: string | null
  createdAt: string
}

/**
 * SSRF guard: only allow public http(s) targets. Blocks loopback, link-local
 * (incl. cloud metadata 169.254.169.254), and RFC-1918 private ranges so a
 * webhook can't be pointed at internal infrastructure.
 */
export function isSafeWebhookUrl(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false
  const host = u.hostname.toLowerCase()
  if (host === "localhost" || host.endsWith(".localhost")) return false
  if (
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "::1" ||
    host === "0.0.0.0"
  ) {
    return false
  }
  return true
}

export async function listEndpoints(): Promise<WebhookEndpoint[]> {
  if (!db) return []
  const rows = await db
    .select()
    .from(webhookEndpoints)
    .orderBy(desc(webhookEndpoints.createdAt))
  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    description: r.description ?? null,
    active: r.active,
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function addEndpoint(url: string, description?: string) {
  if (!db) return
  await db.insert(webhookEndpoints).values({ url, description: description ?? null })
}

export async function deleteEndpoint(id: string) {
  if (!db) return
  await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, id))
}

export async function listDeliveries(limit = 50): Promise<WebhookDelivery[]> {
  if (!db) return []
  const rows = await db
    .select({
      id: webhookDeliveries.id,
      eventType: webhookDeliveries.eventType,
      status: webhookDeliveries.status,
      statusCode: webhookDeliveries.statusCode,
      url: webhookEndpoints.url,
      createdAt: webhookDeliveries.createdAt,
    })
    .from(webhookDeliveries)
    .leftJoin(
      webhookEndpoints,
      eq(webhookDeliveries.endpointId, webhookEndpoints.id),
    )
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(limit)
  return rows.map((r) => ({
    id: r.id,
    eventType: r.eventType,
    status: r.status,
    statusCode: r.statusCode ?? null,
    url: r.url ?? null,
    createdAt: r.createdAt.toISOString(),
  }))
}

/** Fan a signed-ish event out to all active endpoints and log each delivery. */
export async function deliverWebhooks(eventType: string, data: unknown) {
  if (!db) return
  const eps = await db
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.active, true))

  const body = JSON.stringify({
    type: eventType,
    data,
    sentAt: new Date().toISOString(),
  })

  await Promise.all(
    eps.map(async (ep) => {
      let status = "failed"
      let statusCode: number | null = null
      if (isSafeWebhookUrl(ep.url)) {
        try {
          const ctrl = new AbortController()
          const t = setTimeout(() => ctrl.abort(), 4000)
          const res = await fetch(ep.url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-ledgerline-event": eventType,
            },
            body,
            signal: ctrl.signal,
          })
          clearTimeout(t)
          statusCode = res.status
          status = res.ok ? "success" : "failed"
        } catch {
          status = "failed"
        }
      } else {
        status = "blocked"
      }
      await db
        .insert(webhookDeliveries)
        .values({ endpointId: ep.id, eventType, status, statusCode })
    }),
  )
}
