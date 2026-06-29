import { SiteHeader } from "@/components/site-header"
import { DbBanner } from "@/components/db-banner"
import { PricingSimulator } from "@/components/pricing-simulator"
import { getPricing } from "@/lib/repository"

export const dynamic = "force-dynamic"

export default async function PricingPage() {
  const pricing = await getPricing()
  // exclude the internal 'credit' correction line from the revenue rate card
  const rateCard = pricing.filter((p) => p.metric !== "credit")

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <DbBanner />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Pricing simulator
          </h1>
          <p className="text-sm text-muted-foreground text-pretty">
            Draft a new rate card and replay the entire usage ledger through it to
            see the revenue impact before you ship a price change.
          </p>
        </div>
        <PricingSimulator current={rateCard} />
      </main>
    </div>
  )
}
