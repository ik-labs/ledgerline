"use client"

import { useRouter } from "next/navigation"
import { ChevronRight, Users } from "lucide-react"
import { StatusBadge } from "@/components/status-badge"
import { MiniBar } from "@/components/charts"
import { formatCents } from "@/lib/format"
import { slugify } from "@/lib/slug"
import type { CustomerSummary } from "@/lib/types"

export function CustomersTable({
  customers,
}: {
  customers: CustomerSummary[]
}) {
  const router = useRouter()
  const maxTotal = Math.max(...customers.map((c) => c.runningTotalCents), 1)

  if (customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <Users className="h-5 w-5 text-muted-foreground" />
        </span>
        <p className="text-sm font-medium text-foreground">No customers yet</p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground text-pretty">
          Customers appear here once they exist in the database. Seed the rate
          card and sample customers to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-4 py-2.5 font-medium text-muted-foreground">
              Customer
            </th>
            <th className="px-4 py-2.5 font-medium text-muted-foreground">
              Plan
            </th>
            <th className="hidden px-4 py-2.5 font-medium text-muted-foreground sm:table-cell">
              Status
            </th>
            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
              This cycle
            </th>
            <th className="w-8 px-2 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr
              key={c.id}
              tabIndex={0}
              onClick={() => router.push(`/customers/${slugify(c.name)}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter")
                  router.push(`/customers/${slugify(c.name)}`)
              }}
              className="group cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
            >
              <td className="px-4 py-3 font-medium text-foreground">
                {c.name}
              </td>
              <td className="px-4 py-3">
                <span className="rounded-md border border-border px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                  {c.plan}
                </span>
              </td>
              <td className="hidden px-4 py-3 sm:table-cell">
                <StatusBadge status={c.status} />
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col items-end gap-1.5">
                  <span className="font-mono tabular-nums text-foreground">
                    {formatCents(c.runningTotalCents)}
                  </span>
                  <div className="w-24">
                    <MiniBar fraction={c.runningTotalCents / maxTotal} />
                  </div>
                </div>
              </td>
              <td className="px-2 py-3 text-muted-foreground">
                <ChevronRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
