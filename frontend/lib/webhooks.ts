import dns from "node:dns/promises"
import net from "node:net"
import ipaddr from "ipaddr.js"
import { desc, eq } from "drizzle-orm"
import { db } from "./db/client"
import { webhookDeliveries, webhookEndpoints } from "./db/schema"

/** True only for globally-routable (public) unicast addresses. */
function isPublicIp(ip: string): boolean {
  let addr: ipaddr.IPv4 | ipaddr.IPv6
  try {
    addr = ipaddr.parse(ip)
  } catch {
    return false
  }
  if (addr.kind() === "ipv6") {
    const a6 = addr as ipaddr.IPv6
    if (a6.isIPv4MappedAddress()) return isPublicIp(a6.toIPv4Address().toString())
    return a6.range() === "unicast" // excludes loopback/linkLocal/uniqueLocal/etc.
  }
  return (addr as ipaddr.IPv4).range() === "unicast" // excludes private/loopback/CGNAT/etc.
}

/** Resolve the host and require EVERY A/AAAA record to be public. */
async function hostIsPublic(rawHost: string): Promise<boolean> {
  const host = rawHost.replace(/\.$/, "").toLowerCase()
  if (host === "localhost" || host.endsWith(".localhost")) return false
  if (net.isIP(host)) return isPublicIp(host)
  try {
    const addrs = await dns.lookup(host, { all: true })
    return addrs.length > 0 && addrs.every((a) => isPublicIp(a.address))
  } catch {
    return false
  }
}

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

/** Fast SYNCHRONOUS pre-filter (registration UX): protocol + literal-IP check. */
export function isSafeWebhookUrl(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false
  const host = u.hostname.replace(/\.$/, "").toLowerCase()
  if (host === "localhost" || host.endsWith(".localhost")) return false
  if (net.isIP(host) && !isPublicIp(host)) return false // blocks numeric/IPv6 literals
  return true
}

/** AUTHORITATIVE async check: resolves DNS and requires all records public. */
export async function urlIsDeliverable(raw: string): Promise<boolean> {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false
  return hostIsPublic(u.hostname)
}

/**
 * fetch with manual redirect handling — every hop (incl. the Location target)
 * is DNS-validated before we connect, so a redirect can't bounce into internal
 * infrastructure. Returns null if blocked or too many redirects.
 *
 * Residual: a DNS rebind between validation and connect (TOCTOU) isn't fully
 * closed here — that needs IP pinning, which breaks TLS SNI for https sinks.
 * Acceptable for this key-guarded, operator-only feature.
 */
async function safeFetch(
  url: string,
  init: RequestInit,
  maxHops = 3,
): Promise<Response | null> {
  let current = url
  for (let hop = 0; hop <= maxHops; hop++) {
    if (!(await urlIsDeliverable(current))) return null
    const res = await fetch(current, { ...init, redirect: "manual" })
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location")
      if (!loc) return res
      current = new URL(loc, current).toString()
      continue
    }
    return res
  }
  return null
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
      try {
        const ctrl = new AbortController()
        const t = setTimeout(() => ctrl.abort(), 4000)
        const res = await safeFetch(ep.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-ledgerline-event": eventType,
          },
          body,
          signal: ctrl.signal,
        })
        clearTimeout(t)
        if (res === null) {
          status = "blocked" // failed DNS/IP validation or redirect loop
        } else {
          statusCode = res.status
          status = res.ok ? "success" : "failed"
        }
      } catch {
        status = "failed"
      }
      await db
        .insert(webhookDeliveries)
        .values({ endpointId: ep.id, eventType, status, statusCode })
    }),
  )
}
