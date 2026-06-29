import { SiteHeader } from "@/components/site-header"
import { DbBanner } from "@/components/db-banner"
import { CustomersTable } from "@/components/customers-table"
import { getCustomerSummaries } from "@/lib/repository"
import { formatCents } from "@/lib/format"

export const dynamic = "force-dynamic"

export default async function CustomersPage() {
  const customers = await getCustomerSummaries()
  const totalCents = customers.reduce((s, c) => s + c.runningTotalCents, 0)
  const overLimit = customers.filter((c) => c.status === "over").length

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <DbBanner />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground text-balance">
            Customers
          </h1>
          <p className="text-sm text-muted-foreground text-pretty">
            Metered usage and running cost for the current billing cycle.
          </p>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
          <Stat label="Customers" value={String(customers.length)} mono />
          <Stat label="Cycle revenue" value={formatCents(totalCents)} mono />
          <Stat
            label="Over limit"
            value={String(overLimit)}
            mono
            tone={overLimit > 0 ? "warn" : "default"}
          />
        </dl>

        <div className="mt-6">
          <CustomersTable customers={customers} />
        </div>
      </main>
    </div>
  )
}

function Stat({
  label,
  value,
  mono,
  tone = "default",
}: {
  label: string
  value: string
  mono?: boolean
  tone?: "default" | "warn"
}) {
  return (
    <div className="bg-card px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`mt-1 text-lg font-semibold tabular-nums ${
          mono ? "font-mono" : ""
        } ${tone === "warn" ? "text-warning" : "text-foreground"}`}
      >
        {value}
      </dd>
    </div>
  )
}
