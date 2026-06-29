"use client"

import useSWR from "swr"
import { MiniBar } from "@/components/charts"
import { formatCents, metricLabel } from "@/lib/format"

const fetcher = (u: string) => fetch(u).then((r) => r.json())

interface Analytics {
  totalRevenueCents: number
  projectedCents: number
  customerCount: number
  overLimit: number
  eventCount: number
  avgRevenuePerCustomerCents: number
  revenueByMetric: { metric: string; cents: number }[]
  topCustomers: { id: string; name: string; cents: number; status: string }[]
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "warn"
}) {
  return (
    <div className="bg-card px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`mt-1 font-mono text-lg font-semibold tabular-nums ${
          tone === "warn" ? "text-warning" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  )
}

function BarList({
  title,
  rows,
}: {
  title: string
  rows: { label: string; cents: number }[]
}) {
  const max = Math.max(...rows.map((r) => r.cents), 1)
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
      </div>
      <div className="flex flex-col divide-y divide-border">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No revenue yet.
          </p>
        ) : (
          rows.map((r) => (
            <div key={r.label} className="flex flex-col gap-1.5 px-4 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground">{r.label}</span>
                <span className="font-mono tabular-nums text-muted-foreground">
                  {formatCents(r.cents)}
                </span>
              </div>
              <MiniBar fraction={r.cents / max} />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function RevenueAnalytics() {
  const { data } = useSWR<Analytics>("/api/analytics", fetcher, {
    refreshInterval: 4000,
  })

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
        <Stat
          label="Cycle revenue"
          value={data ? formatCents(data.totalRevenueCents) : "—"}
        />
        <Stat
          label="Projected"
          value={data ? formatCents(data.projectedCents) : "—"}
        />
        <Stat
          label="Avg / customer"
          value={data ? formatCents(data.avgRevenuePerCustomerCents) : "—"}
        />
        <Stat label="Customers" value={data ? String(data.customerCount) : "—"} />
        <Stat
          label="Events (cycle)"
          value={data ? data.eventCount.toLocaleString() : "—"}
        />
        <Stat
          label="Over limit"
          value={data ? String(data.overLimit) : "—"}
          tone={data && data.overLimit > 0 ? "warn" : undefined}
        />
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <BarList
          title="Revenue by metric"
          rows={(data?.revenueByMetric ?? []).map((r) => ({
            label: metricLabel(r.metric),
            cents: r.cents,
          }))}
        />
        <BarList
          title="Top customers"
          rows={(data?.topCustomers ?? []).map((r) => ({
            label: r.name,
            cents: r.cents,
          }))}
        />
      </div>
    </div>
  )
}
