import { PrintButton } from "@/components/print-button"
import {
  formatCents,
  formatDate,
  formatPeriod,
  formatQuantity,
  metricLabel,
} from "@/lib/format"
import type { Invoice, InvoiceLineItem } from "@/lib/types"

export function InvoiceDoc({ invoice }: { invoice: Invoice }) {
  const lines = (invoice.lineItems ?? []) as InvoiceLineItem[]

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card print:border-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
        <div>
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="flex h-6 w-6 items-center justify-center rounded-md bg-primary"
            >
              <span className="h-2.5 w-2.5 rounded-[2px] bg-brand" />
            </span>
            <span className="font-mono text-sm font-semibold text-foreground">
              Ledgerline
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Usage-based billing on Aurora DSQL
          </p>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold tracking-tight text-foreground">
            INVOICE
          </div>
          <div className="font-mono text-[11px] text-muted-foreground">
            {invoice.id}
          </div>
          <span
            className={`mt-1 inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase ${
              invoice.status === "issued"
                ? "border-success/40 text-success"
                : "border-border text-muted-foreground"
            }`}
          >
            {invoice.status}
          </span>
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-4 px-6 py-4 sm:grid-cols-3">
        <div>
          <div className="text-xs text-muted-foreground">Bill to</div>
          <div className="text-sm font-medium text-foreground">
            {invoice.customerName}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Billing period</div>
          <div className="font-mono text-sm text-foreground">
            {formatPeriod(invoice.periodStart, invoice.periodEnd)}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Issued</div>
          <div className="font-mono text-sm text-foreground">
            {formatDate(invoice.createdAt)}
          </div>
        </div>
      </div>

      {/* Line items */}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-border text-left text-xs text-muted-foreground">
            <th className="px-6 py-2 font-medium">Metric</th>
            <th className="px-6 py-2 text-right font-medium">Quantity</th>
            <th className="px-6 py-2 text-right font-medium">Unit</th>
            <th className="px-6 py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                className="px-6 py-8 text-center text-sm text-muted-foreground"
              >
                No line items.
              </td>
            </tr>
          ) : (
            lines.map((l) => (
              <tr key={l.metric} className="border-b border-border">
                <td className="px-6 py-2.5 text-foreground">
                  {metricLabel(l.metric)}
                  {l.tiered && (
                    <span className="ml-2 rounded bg-brand/10 px-1 py-0.5 text-[9px] font-medium text-brand">
                      VOLUME
                    </span>
                  )}
                </td>
                <td className="px-6 py-2.5 text-right font-mono tabular-nums text-muted-foreground">
                  {formatQuantity(l.quantity)}
                </td>
                <td className="px-6 py-2.5 text-right font-mono tabular-nums text-muted-foreground">
                  {l.tiered ? "~" : ""}
                  {formatCents(l.unitPriceCents)}
                </td>
                <td className="px-6 py-2.5 text-right font-mono tabular-nums text-foreground">
                  {formatCents(l.subtotalCents)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Total */}
      <div className="flex items-center justify-between gap-4 px-6 py-5">
        <PrintButton />
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Total due</div>
          <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">
            {formatCents(invoice.totalCents)}
          </div>
        </div>
      </div>
    </div>
  )
}
