"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Minus,
  Zap,
} from "lucide-react"
import Link from "next/link"
import { postWrite } from "@/lib/client-write"
import { ConsistencyTest } from "@/components/consistency-test"
import { AuditTrail } from "@/components/audit-trail"
import { PrepaidCard } from "@/components/prepaid-card"
import { SpendAreaChart } from "@/components/charts"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import { useCountUp } from "@/hooks/use-count-up"
import {
  describeEvent,
  formatCents,
  formatQuantity,
  formatRelativeTime,
  metricLabel,
} from "@/lib/format"
import type { CustomerUsage } from "@/lib/types"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function CustomerDetail({
  customerId,
  initialData,
}: {
  customerId: string
  initialData: CustomerUsage
}) {
  const { data, mutate } = useSWR<CustomerUsage>(
    `/api/customers/${customerId}/usage`,
    fetcher,
    { refreshInterval: 2000, fallbackData: initialData },
  )

  const usage = data ?? initialData
  const animatedTotal = useCountUp(usage.runningTotalCents)
  const [simulating, setSimulating] = useState(false)
  const [crediting, setCrediting] = useState(false)
  const seenIds = useRef<Set<string>>(
    new Set(initialData.recentEvents.map((e) => e.id)),
  )
  const [newIds, setNewIds] = useState<Set<string>>(new Set())

  // Track which events are newly arrived so we can highlight them.
  useEffect(() => {
    const fresh = new Set<string>()
    for (const e of usage.recentEvents) {
      if (!seenIds.current.has(e.id)) {
        fresh.add(e.id)
        seenIds.current.add(e.id)
      }
    }
    if (fresh.size > 0) {
      setNewIds(fresh)
      const t = setTimeout(() => setNewIds(new Set()), 1500)
      return () => clearTimeout(t)
    }
  }, [usage.recentEvents])

  const simulate = useCallback(async () => {
    setSimulating(true)
    try {
      // Server-side generation: events are created and pushed through the same
      // ingest path on the server, so the browser never holds the ingest secret.
      const res = await postWrite("/api/simulate", { customerId })
      if (!res.ok) throw new Error("simulate failed")
      const { count } = await res.json()
      toast.success(`Sent ${count} usage events`, {
        description: "Watch the live meter tick up.",
      })
    } catch {
      toast.error("Failed to simulate usage")
    } finally {
      setSimulating(false)
    }
  }, [customerId])

  const issueCredit = useCallback(async () => {
    setCrediting(true)
    try {
      // A credit is a NEW append-only event with negative quantity (priced at
      // 1c/unit) — corrections are events, never edits. Flows through SQS too.
      const res = await postWrite("/api/ingest", {
        customer_id: customerId,
        metric: "credit",
        quantity: -500, // -$5.00
        idempotency_key: `credit-${customerId}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
      })
      if (!res.ok) throw new Error("credit failed")
      toast.success("Issued $5.00 credit", {
        description: "Recorded as a correction event — the ledger stays append-only.",
      })
      setTimeout(() => mutate(), 1500)
    } catch {
      toast.error("Failed to issue credit")
    } finally {
      setCrediting(false)
    }
  }, [customerId, mutate])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All customers
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground text-balance">
              {usage.customer.name}
            </h1>
            <span className="rounded-md border border-border px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
              {usage.customer.plan}
            </span>
          </div>
          <StatusBadge status={usage.status} />
        </div>
        <div className="flex flex-col sm:items-end">
          <span className="text-xs text-muted-foreground">
            Current cycle cost
          </span>
          <span className="font-mono text-4xl font-semibold tabular-nums tracking-tight text-foreground">
            {formatCents(animatedTotal)}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            limit {formatCents(usage.customer.spendThresholdCents)}
          </span>
        </div>
      </div>

      {usage.status !== "ok" && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
            usage.status === "over"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-warning/40 bg-warning/10 text-warning"
          }`}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            {usage.status === "over"
              ? `${usage.customer.name} has crossed its ${formatCents(
                  usage.customer.spendThresholdCents,
                )} spend threshold — a threshold alert was triggered (Amazon SNS).`
              : `${usage.customer.name} is approaching its ${formatCents(
                  usage.customer.spendThresholdCents,
                )} spend threshold.`}
          </span>
        </div>
      )}

      <PrepaidCard
        customerId={customerId}
        prepaid={usage.prepaid}
        onChange={() => mutate()}
      />

      {/* Spend trend */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium text-foreground">Spend this cycle</h2>
          {usage.runningTotalCents > 0 && (
            <span className="font-mono text-xs text-muted-foreground">
              projected{" "}
              <span className="text-foreground">
                {formatCents(usage.projectedCents)}
              </span>{" "}
              by cycle end
            </span>
          )}
        </div>
        {usage.runningTotalCents > 0 ? (
          <div className="px-2 pb-2 pt-4">
            <SpendAreaChart
              data={usage.dailySeries}
              projectedCents={usage.projectedCents}
              progress={usage.cycleProgress}
            />
          </div>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No spend yet this cycle.
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Live meter */}
        <section className="lg:col-span-3">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-brand" />
                <h2 className="text-sm font-medium text-foreground">
                  Live meter
                </h2>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                  </span>
                  live
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={issueCredit}
                  disabled={crediting}
                  title="Issue a $5 credit as an append-only correction event"
                >
                  {crediting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Minus className="h-3.5 w-3.5" />
                  )}
                  Credit $5
                </Button>
                <Button
                  size="sm"
                  onClick={simulate}
                  disabled={simulating}
                  className="bg-brand text-brand-foreground hover:bg-brand/90"
                >
                  {simulating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Zap className="h-3.5 w-3.5" />
                  )}
                  Simulate usage
                </Button>
              </div>
            </div>

            {usage.breakdown.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                No usage this cycle yet. Hit{" "}
                <span className="font-medium text-foreground">
                  Simulate usage
                </span>{" "}
                to send some events.
              </p>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Metric</th>
                    <th className="px-4 py-2 text-right font-medium">
                      Quantity
                    </th>
                    <th className="px-4 py-2 text-right font-medium">
                      Unit price
                    </th>
                    <th className="px-4 py-2 text-right font-medium">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {usage.breakdown.map((b) => (
                    <tr
                      key={b.metric}
                      className="border-b border-border last:border-b-0"
                    >
                      <td className="px-4 py-2.5 text-foreground">
                        {metricLabel(b.metric)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-muted-foreground">
                        {b.metric === "credit" ? "—" : formatQuantity(b.quantity)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-muted-foreground">
                        {b.metric === "credit" ? (
                          "—"
                        ) : (
                          <span className="inline-flex items-center justify-end gap-1.5">
                            {b.tiered && (
                              <span className="rounded bg-brand/10 px-1 py-0.5 text-[9px] font-medium tracking-wide text-brand">
                                VOLUME
                              </span>
                            )}
                            {b.tiered
                              ? `~${formatCents(b.unitPriceCents)}`
                              : formatCents(b.unitPriceCents)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground">
                        {formatCents(b.subtotalCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/40">
                    <td
                      className="px-4 py-2.5 text-xs font-medium text-muted-foreground"
                      colSpan={3}
                    >
                      Running total
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-foreground">
                      {formatCents(usage.runningTotalCents)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </section>

        {/* Recent events feed */}
        <section className="lg:col-span-2">
          <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-medium text-foreground">
                Recent events
              </h2>
            </div>
            <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto">
              {usage.recentEvents.length === 0 ? (
                <li className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No events yet.
                </li>
              ) : (
                usage.recentEvents.map((e) => (
                  <li
                    key={e.id}
                    className={`flex items-center justify-between gap-3 px-4 py-2.5 transition-colors duration-700 ${
                      newIds.has(e.id) ? "bg-brand/10" : "bg-transparent"
                    }`}
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm text-foreground">
                        {describeEvent(e.metric, e.quantity)}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatRelativeTime(e.eventTime)}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
                      {formatCents(e.subtotalCents)}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ConsistencyTest customerId={customerId} onComplete={() => mutate()} />
        <AuditTrail customerId={customerId} />
      </div>
    </div>
  )
}
