import { Layers } from "lucide-react"
import { formatCents, formatQuantity, metricLabel } from "@/lib/format"
import type { Subscription } from "@/lib/types"

export function SubscriptionCard({
  subscription,
}: {
  subscription: Subscription | null
}) {
  if (!subscription) return null
  const s = subscription

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-brand" />
          <h2 className="text-sm font-medium text-foreground">
            Subscription · {s.planName}
          </h2>
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          base {formatCents(s.baseFeeCents)}/cycle
        </span>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="px-4 py-2 font-medium">Metric</th>
            <th className="px-4 py-2 text-right font-medium">Used</th>
            <th className="px-4 py-2 text-right font-medium">Included</th>
            <th className="px-4 py-2 text-right font-medium">Overage</th>
          </tr>
        </thead>
        <tbody>
          {s.lines.map((l) => {
            const over = l.billedQty > 0
            return (
              <tr key={l.metric} className="border-b border-border last:border-b-0">
                <td className="px-4 py-2.5 text-foreground">
                  {metricLabel(l.metric)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-muted-foreground">
                  {formatQuantity(l.usedQty)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-muted-foreground">
                  {formatQuantity(l.includedQty)}
                </td>
                <td
                  className={`px-4 py-2.5 text-right font-mono tabular-nums ${
                    over ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {over ? formatCents(l.overageCents) : "included"}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="flex items-center justify-between gap-6 border-t border-border px-4 py-3">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span>
            Base{" "}
            <span className="font-mono text-foreground">
              {formatCents(s.baseFeeCents)}
            </span>
          </span>
          <span>
            Overage{" "}
            <span className="font-mono text-foreground">
              {formatCents(s.overageCents)}
            </span>
          </span>
          {s.trueUpCents > 0 && (
            <span className="text-warning">
              True-up to {formatCents(s.minimumCents)} min{" "}
              <span className="font-mono">+{formatCents(s.trueUpCents)}</span>
            </span>
          )}
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Total due this cycle</div>
          <div className="font-mono text-lg font-semibold tabular-nums text-foreground">
            {formatCents(s.totalDueCents)}
          </div>
        </div>
      </div>
    </div>
  )
}
