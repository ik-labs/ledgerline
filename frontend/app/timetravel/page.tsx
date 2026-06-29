import { SiteHeader } from "@/components/site-header"
import { DbBanner } from "@/components/db-banner"
import { TimeTravel } from "@/components/time-travel"

export const dynamic = "force-dynamic"

export default function TimeTravelPage() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <DbBanner />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Time travel
          </h1>
          <p className="text-sm text-muted-foreground text-pretty">
            Replay the ledger to any moment in the cycle and see exactly what the
            meter read.
          </p>
        </div>
        <TimeTravel />
      </main>
    </div>
  )
}
