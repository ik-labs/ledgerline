import { notFound } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { DbBanner } from "@/components/db-banner"
import { CustomerDetail } from "@/components/customer-detail"
import { getCustomerUsageByParam } from "@/lib/repository"

export const dynamic = "force-dynamic"

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // `id` may be a UUID or a friendly name-slug.
  const { id } = await params
  const usage = await getCustomerUsageByParam(id)
  if (!usage) notFound()

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <DbBanner />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Always use the real UUID internally for API / ingest / stress calls. */}
        <CustomerDetail customerId={usage.customer.id} initialData={usage} />
      </main>
    </div>
  )
}
