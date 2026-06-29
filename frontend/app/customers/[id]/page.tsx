import { notFound } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { DbBanner } from "@/components/db-banner"
import { CustomerDetail } from "@/components/customer-detail"
import { getCustomerUsage } from "@/lib/repository"

export const dynamic = "force-dynamic"

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const usage = await getCustomerUsage(id)
  if (!usage) notFound()

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <DbBanner />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <CustomerDetail customerId={id} initialData={usage} />
      </main>
    </div>
  )
}
