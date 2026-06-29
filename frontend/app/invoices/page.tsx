import { SiteHeader } from "@/components/site-header"
import { DbBanner } from "@/components/db-banner"
import { InvoicesView } from "@/components/invoices-view"
import { getInvoices } from "@/lib/repository"

export const dynamic = "force-dynamic"

export default async function InvoicesPage() {
  const invoices = await getInvoices()

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <DbBanner />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <InvoicesView initial={invoices} />
      </main>
    </div>
  )
}
