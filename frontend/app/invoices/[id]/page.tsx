import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { DbBanner } from "@/components/db-banner"
import { InvoiceDoc } from "@/components/invoice-doc"
import { getInvoiceById } from "@/lib/repository"

export const dynamic = "force-dynamic"

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const invoice = await getInvoiceById(id)
  if (!invoice) notFound()

  return (
    <div className="min-h-dvh">
      <div className="print:hidden">
        <SiteHeader />
        <DbBanner />
      </div>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link
          href="/invoices"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Invoices
        </Link>
        <InvoiceDoc invoice={invoice} />
      </main>
    </div>
  )
}
