"use client"

import { useEffect, useMemo, useState } from "react"
import { Clock, History } from "lucide-react"
import { MiniBar } from "@/components/charts"
import { formatCents } from "@/lib/format"

interface TT {
  at: string
  totalCents: number
  eventCount: number
  rows: { id: string; name: string; cents: number }[]
}

function fmtWhen(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function TimeTravel() {
  const { startMs, nowMs } = useMemo(() => {
    const d = new Date()
    return {
      startMs: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1),
      nowMs: Date.now(),
    }
  }, [])

  const [atMs, setAtMs] = useState(nowMs)
  const [data, setData] = useState<TT | null>(null)

  useEffect(() => {
    const id = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/timetravel?at=${new Date(atMs).toISOString()}`,
        )
        if (res.ok) setData(await res.json())
      } catch {
        // ignore
      }
    }, 120)
    return () => clearTimeout(id)
  }, [atMs])

  const max = Math.max(...(data?.rows.map((r) => r.cents) ?? [1]), 1)
  const isNow = nowMs - atMs < 60_000

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-brand" />
          <h2 className="text-sm font-medium text-foreground">
            Point-in-time meter
          </h2>
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {data?.eventCount ?? 0} events ≤ cutoff
        </span>
      </div>

      <div className="px-4 py-5">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs text-muted-foreground">
              Total billed as of
            </div>
            <div className="flex items-center gap-2 font-mono text-sm text-foreground">
              <Clock className="h-3.5 w-3.5 text-brand" />
              {isNow ? "now" : fmtWhen(atMs)}
            </div>
          </div>
          <div className="font-mono text-3xl font-semibold tabular-nums text-foreground">
            {data ? formatCents(data.totalCents) : "—"}
          </div>
        </div>

        <input
          type="range"
          min={startMs}
          max={nowMs}
          step={Math.max(1, Math.round((nowMs - startMs) / 500))}
          value={atMs}
          onChange={(e) => setAtMs(Number(e.target.value))}
          className="mt-5 w-full accent-[var(--brand)]"
          aria-label="Time cutoff"
        />
        <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>{fmtWhen(startMs)} · cycle start</span>
          <span>now</span>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          {(data?.rows ?? []).map((r) => (
            <div key={r.id} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground">{r.name}</span>
                <span className="font-mono tabular-nums text-muted-foreground">
                  {formatCents(r.cents)}
                </span>
              </div>
              <MiniBar fraction={r.cents / max} />
            </div>
          ))}
        </div>

        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
          Drag back in time — totals are re-derived by re-pricing only the events
          recorded up to that instant. Exact at any point because the DSQL ledger
          is append-only and strongly consistent.
        </p>
      </div>
    </div>
  )
}
