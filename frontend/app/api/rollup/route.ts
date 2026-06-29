import { NextResponse } from "next/server"
import { runRollup } from "@/lib/rollup"
import { checkWriteAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  // In-app admin action: requires the write key.
  const denied = checkWriteAuth(request)
  if (denied) return denied

  try {
    const invoices = await runRollup()
    return NextResponse.json({ ok: true, invoices })
  } catch (error) {
    console.error("[v0] rollup error:", error)
    return NextResponse.json(
      { error: "Failed to run roll-up" },
      { status: 500 },
    )
  }
}
