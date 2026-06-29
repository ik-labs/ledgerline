import { SiteHeader } from "@/components/site-header"
import { DbBanner } from "@/components/db-banner"
import { WebhooksView } from "@/components/webhooks-view"

export const dynamic = "force-dynamic"

export default function WebhooksPage() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <DbBanner />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Webhooks
          </h1>
          <p className="text-sm text-muted-foreground text-pretty">
            Register endpoints to receive <span className="font-mono">invoice.issued</span> and
            test events. Every delivery is logged.
          </p>
        </div>
        <WebhooksView />
      </main>
    </div>
  )
}
