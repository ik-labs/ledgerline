import { NextResponse } from "next/server"
import { getInvoices } from "@/lib/repository"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const invoices = await getInvoices()
    return NextResponse.json({ invoices })
  } catch (error) {
    console.error("[v0] invoices error:", error)
    return NextResponse.json(
      { error: "Failed to load invoices" },
      { status: 500 },
    )
  }
}
