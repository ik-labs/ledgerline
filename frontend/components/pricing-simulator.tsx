"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, FlaskConical, TrendingUp, TrendingDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatCents, metricLabel } from "@/lib/format"
import type { PricingRate } from "@/lib/types"

interface SimRow {
  id: string
  name: string
  currentCents: number
  draftCents: number
  deltaCents: number
}
interface SimResult {
  rows: SimRow[]
  totals: { currentCents: number; draftCents: number; deltaCents: number }
}

function deltaText(cents: number): string {
  const sign = cents > 0 ? "+" : cents < 0 ? "−" : ""
  return `${sign}${formatCents(Math.abs(cents))}`
}

export function PricingSimulator({ current }: { current: PricingRate[] }) {
  // editable draft prices in dollars, pre-filled from current flat rates
  const initial = Object.fromEntries(
    current.map((p) => [p.metric, p.unitPriceCents / 100]),
  )
  const [prices, setPrices] = useState<Record<string, number>>(initial)
  const [result, setResult] = useState<SimResult | null>(null)
  const [loading, setLoading] = useState(false)

  function set(metric: string, dollars: number) {
    setPrices((p) => ({ ...p, [metric]: dollars }))
  }
  function bump(factor: number) {
    setPrices((p) =>
      Object.fromEntries(
        Object.entries(p).map(([m, v]) => [
          m,
          Math.round(v * factor * 1000) / 1000,
        ]),
      ),
    )
  }
  function reset() {
    setPrices(initial)
    setResult(null)
  }

  async function simulate() {
    setLoading(true)
    try {
      const draft: PricingRate[] = current.map((p) => ({
        metric: p.metric,
        unitPriceCents: Math.round((prices[p.metric] ?? 0) * 100),
      }))
      const res = await fetch("/api/pricing/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      })
      if (!res.ok) throw new Error()
      setResult(await res.json())
    } catch {
      toast.error("Simulation failed")
    } finally {
      setLoading(false)
    }
  }

  const up = (result?.totals.deltaCents ?? 0) >= 0

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Editable rate card */}
      <div className="lg:col-span-2">
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <FlaskConical className="h-4 w-4 text-brand" />
            <h2 className="text-sm font-medium text-foreground">Draft rate card</h2>
          </div>
          <div className="flex flex-col divide-y divide-border">
            {current.map((p) => (
              <label
                key={p.metric}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <span className="text-sm text-foreground">
                  {metricLabel(p.metric)}
                  {p.tiers && p.tiers.length > 0 && (
                    <span className="ml-2 rounded bg-brand/10 px-1 py-0.5 text-[9px] font-medium text-brand">
                      now tiered
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1 font-mono text-sm">
                  <span className="text-muted-foreground">$</span>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={prices[p.metric] ?? 0}
                    onChange={(e) => set(p.metric, Number(e.target.value))}
                    className="w-24 rounded-md border border-border bg-background px-2 py-1 text-right tabular-nums outline-none focus:border-brand"
                  />
                </span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
            <Button size="sm" variant="outline" onClick={() => bump(1.1)}>
              +10%
            </Button>
            <Button size="sm" variant="outline" onClick={() => bump(0.9)}>
              −10%
            </Button>
            <Button size="sm" variant="outline" onClick={reset}>
              Reset
            </Button>
            <Button
              size="sm"
              onClick={simulate}
              disabled={loading}
              className="ml-auto bg-brand text-brand-foreground hover:bg-brand/90"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FlaskConical className="h-3.5 w-3.5" />
              )}
              Simulate
            </Button>
          </div>
        </div>
        <p className="mt-3 px-1 text-xs leading-relaxed text-muted-foreground">
          Replays the complete DSQL event ledger through this draft card and
          re-derives revenue exactly — only possible because the ledger is
          strongly consistent and append-only. Draft rates apply flat (no tiers).
        </p>
      </div>

      {/* Results */}
      <div className="lg:col-span-3">
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-medium text-foreground">
              Projected revenue impact
            </h2>
          </div>
          {!result ? (
            <p className="px-4 py-16 text-center text-sm text-muted-foreground">
              Edit the rate card and hit{" "}
              <span className="font-medium text-foreground">Simulate</span>.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-6 border-b border-border px-4 py-4">
                <div>
                  <div className="text-xs text-muted-foreground">Current</div>
                  <div className="font-mono text-lg tabular-nums text-foreground">
                    {formatCents(result.totals.currentCents)}
                  </div>
                </div>
                <div className="text-muted-foreground">→</div>
                <div>
                  <div className="text-xs text-muted-foreground">Draft</div>
                  <div className="font-mono text-lg tabular-nums text-foreground">
                    {formatCents(result.totals.draftCents)}
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-xs text-muted-foreground">
                    This cycle delta
                  </div>
                  <div
                    className={`flex items-center justify-end gap-1 font-mono text-2xl font-semibold tabular-nums ${
                      up ? "text-success" : "text-destructive"
                    }`}
                  >
                    {up ? (
                      <TrendingUp className="h-5 w-5" />
                    ) : (
                      <TrendingDown className="h-5 w-5" />
                    )}
                    {deltaText(result.totals.deltaCents)}
                  </div>
                </div>
              </div>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Customer</th>
                    <th className="px-4 py-2 text-right font-medium">Current</th>
                    <th className="px-4 py-2 text-right font-medium">Draft</th>
                    <th className="px-4 py-2 text-right font-medium">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-2.5 text-foreground">{r.name}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-muted-foreground">
                        {formatCents(r.currentCents)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground">
                        {formatCents(r.draftCents)}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-mono tabular-nums ${
                          r.deltaCents > 0
                            ? "text-success"
                            : r.deltaCents < 0
                              ? "text-destructive"
                              : "text-muted-foreground"
                        }`}
                      >
                        {deltaText(r.deltaCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
