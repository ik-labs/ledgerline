import { NextResponse } from "next/server"
import { runRollup } from "@/lib/rollup"

export const dynamic = "force-dynamic"

export async function POST() {
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
