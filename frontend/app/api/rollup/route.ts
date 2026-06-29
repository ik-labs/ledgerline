import { NextResponse } from "next/server"
import { runRollup } from "@/lib/rollup"
import { checkWriteAuth } from "@/lib/auth"
import { deliverWebhooks } from "@/lib/webhooks"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  // In-app admin action: requires the write key.
  const denied = checkWriteAuth(request)
  if (denied) return denied

  try {
    const invoices = await runRollup()
    // Notify registered webhook endpoints (best-effort; never block the roll-up).
    if (invoices.length > 0) {
      await deliverWebhooks("invoice.issued", {
        count: invoices.length,
        invoices: invoices.map((i) => ({
          id: i.id,
          customer: i.customerName,
          totalCents: i.totalCents,
        })),
      }).catch(() => {})
    }
    return NextResponse.json({ ok: true, invoices })
  } catch (error) {
    console.error("[v0] rollup error:", error)
    return NextResponse.json(
      { error: "Failed to run roll-up" },
      { status: 500 },
    )
  }
}
