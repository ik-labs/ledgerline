"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { ChevronDown, FileText, Loader2, Play } from "lucide-react"
import { postWrite } from "@/lib/client-write"
import { Button } from "@/components/ui/button"
import {
  formatCents,
  formatDate,
  formatPeriod,
  formatQuantity,
  metricLabel,
} from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Invoice } from "@/lib/types"

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json() as Promise<{ invoices: Invoice[] }>)

export function InvoicesView({ initial }: { initial: Invoice[] }) {
  const { data, mutate } = useSWR("/api/invoices", fetcher, {
    fallbackData: { invoices: initial },
  })
  const invoices = data?.invoices ?? initial
  const [expanded, setExpanded] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  async function runRollup() {
    setRunning(true)
    try {
      const res = await postWrite("/api/rollup", {})
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      await mutate()
      toast.success("Roll-up complete", {
        description: `${json.invoices?.length ?? 0} invoice(s) generated for this cycle.`,
      })
    } catch {
      toast.error("Roll-up failed")
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground text-balance">
            Invoices
          </h1>
          <p className="text-sm text-muted-foreground text-pretty">
            Rolled-up usage per customer and billing period.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={runRollup}
          disabled={running}
        >
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          Run roll-up now
        </Button>
      </div>

      {invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
          <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </span>
          <p className="text-sm font-medium text-foreground">No invoices yet</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground text-pretty">
            Run the roll-up to aggregate this cycle&apos;s usage events into
            draft invoices.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="w-8 px-2 py-2.5" />
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">
                  Billing period
                </th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">
                  Created
                </th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const isOpen = expanded === inv.id
                return (
                  <FragmentRow
                    key={inv.id}
                    invoice={inv}
                    isOpen={isOpen}
                    onToggle={() => setExpanded(isOpen ? null : inv.id)}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function FragmentRow({
  invoice,
  isOpen,
  onToggle,
}: {
  invoice: Invoice
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b border-border transition-colors hover:bg-muted/50"
      >
        <td className="px-2 py-3 text-muted-foreground">
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              isOpen && "rotate-180",
            )}
          />
        </td>
        <td className="px-4 py-3 font-medium text-foreground">
          {invoice.customerName}
        </td>
        <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground sm:table-cell">
          {formatPeriod(invoice.periodStart, invoice.periodEnd)}
        </td>
        <td className="px-4 py-3">
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 font-mono text-xs",
              invoice.status === "issued"
                ? "bg-success/15 text-success"
                : "border border-border text-muted-foreground",
            )}
          >
            {invoice.status}
          </span>
        </td>
        <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground md:table-cell">
          {formatDate(invoice.createdAt)}
        </td>
        <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-foreground">
          {formatCents(invoice.totalCents)}
        </td>
      </tr>
      {isOpen && (
        <tr className="border-b border-border bg-muted/20">
          <td />
          <td colSpan={5} className="px-4 py-3">
            <div className="overflow-hidden rounded-md border border-border bg-card">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Metric</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Quantity
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      Unit price
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.map((li) => (
                    <tr
                      key={li.metric}
                      className="border-b border-border last:border-b-0"
                    >
                      <td className="px-3 py-2 text-foreground">
                        {metricLabel(li.metric)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
                        {formatQuantity(li.quantity)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
                        {formatCents(li.unitPriceCents)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-foreground">
                        {formatCents(li.subtotalCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
