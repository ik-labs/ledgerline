import { SiteHeader } from "@/components/site-header"
import { DbBanner } from "@/components/db-banner"
import { RevenueAnalytics } from "@/components/revenue-analytics"

export const dynamic = "force-dynamic"

export default function AnalyticsPage() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <DbBanner />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Revenue analytics
          </h1>
          <p className="text-sm text-muted-foreground text-pretty">
            Live revenue across all customers this billing cycle — derived from the
            Aurora DSQL ledger.
          </p>
        </div>
        <RevenueAnalytics />
      </main>
    </div>
  )
}
