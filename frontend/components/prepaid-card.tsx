"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Wallet } from "lucide-react"
import { postWrite } from "@/lib/client-write"
import { Button } from "@/components/ui/button"
import { formatCents } from "@/lib/format"
import type { PrepaidBalance } from "@/lib/types"

export function PrepaidCard({
  customerId,
  prepaid,
  onChange,
}: {
  customerId: string
  prepaid: PrepaidBalance | null
  onChange: () => void
}) {
  const [granting, setGranting] = useState(false)

  async function grant(amountCents: number) {
    setGranting(true)
    try {
      const res = await postWrite(`/api/customers/${customerId}/grant`, {
        amountCents,
      })
      if (!res.ok) throw new Error()
      toast.success(`Granted ${formatCents(amountCents)} prepaid credit`)
      setTimeout(onChange, 600)
    } catch {
      toast.error("Grant failed")
    } finally {
      setGranting(false)
    }
  }

  if (!prepaid) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            No prepaid balance. Grant a commitment to draw usage down from it.
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={() => grant(50_000)} disabled={granting}>
          {granting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Grant $500
        </Button>
      </div>
    )
  }

  const { grantedCents, usedCents, remainingCents } = prepaid
  const usedFraction = grantedCents > 0 ? Math.min(1, usedCents / grantedCents) : 0
  const exhausted = remainingCents <= 0
  const low = !exhausted && remainingCents < grantedCents * 0.2
  const barColor = exhausted ? "bg-destructive" : low ? "bg-warning" : "bg-brand"

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-brand" />
          <h2 className="text-sm font-medium text-foreground">Prepaid balance</h2>
        </div>
        <Button size="sm" variant="outline" onClick={() => grant(50_000)} disabled={granting}>
          {granting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Top up $500
        </Button>
      </div>
      <div className="px-4 py-4">
        <div className="flex items-baseline justify-between">
          <span
            className={`font-mono text-2xl font-semibold tabular-nums ${
              exhausted ? "text-destructive" : low ? "text-warning" : "text-foreground"
            }`}
          >
            {formatCents(remainingCents)}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            of {formatCents(grantedCents)} remaining
          </span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border">
          <div
            className={`h-full rounded-full ${barColor}`}
            style={{ width: `${usedFraction * 100}%` }}
          />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {exhausted
            ? "Balance exhausted — further usage is billed as overage."
            : low
              ? `${formatCents(usedCents)} drawn down this cycle — running low, auto-recharge recommended.`
              : `${formatCents(usedCents)} drawn down from the prepaid commitment this cycle.`}
        </p>
      </div>
    </div>
  )
}
