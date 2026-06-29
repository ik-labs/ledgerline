import { NextResponse } from "next/server"
import { grantCredits } from "@/lib/repository"
import { checkWriteAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

/** POST /api/customers/:id/grant — append a prepaid credit grant (write). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = checkWriteAuth(request)
  if (denied) return denied

  const { id } = await params
  let amountCents = 50_000 // default $500 top-up
  try {
    const body = await request.json()
    if (body?.amountCents) amountCents = Math.round(Number(body.amountCents))
  } catch {
    // use default
  }
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: "positive amountCents required" }, { status: 400 })
  }

  await grantCredits(id, amountCents)
  return NextResponse.json({ ok: true, amountCents }, { status: 201 })
}
