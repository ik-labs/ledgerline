import { NextResponse } from "next/server"
import { loadSnapshot } from "@/lib/repository"
import { buildCustomerSummaries } from "@/lib/billing"
import type { PricingRate } from "@/lib/types"

export const dynamic = "force-dynamic"

/**
 * POST /api/pricing/simulate — replay the event ledger through a DRAFT rate card.
 *
 * Because the DSQL ledger is complete and strongly consistent, we can re-derive
 * revenue under any pricing exactly. Returns current vs draft revenue per
 * customer and in aggregate. Read-only (no writes).
 *
 * Body: { draft: PricingRate[] }
 */
export async function POST(request: Request) {
  let draft: PricingRate[]
  try {
    draft = (await request.json())?.draft
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  if (!Array.isArray(draft)) {
    return NextResponse.json({ error: "draft pricing array required" }, { status: 400 })
  }

  const { customers, events, pricing } = await loadSnapshot()

  const current = new Map(
    buildCustomerSummaries(customers, events, pricing).map((c) => [c.id, c]),
  )
  const drafted = new Map(
    buildCustomerSummaries(customers, events, draft).map((c) => [c.id, c]),
  )

  const rows = customers
    .map((c) => {
      const cur = current.get(c.id)?.runningTotalCents ?? 0
      const dft = drafted.get(c.id)?.runningTotalCents ?? 0
      return {
        id: c.id,
        name: c.name,
        currentCents: cur,
        draftCents: dft,
        deltaCents: dft - cur,
      }
    })
    .sort((a, b) => b.draftCents - a.draftCents)

  const totals = rows.reduce(
    (acc, r) => ({
      currentCents: acc.currentCents + r.currentCents,
      draftCents: acc.draftCents + r.draftCents,
      deltaCents: acc.deltaCents + r.deltaCents,
    }),
    { currentCents: 0, draftCents: 0, deltaCents: 0 },
  )

  return NextResponse.json({ rows, totals })
}
