import { NextResponse } from "next/server"
import { getCustomerSummaries } from "@/lib/repository"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const customers = await getCustomerSummaries()
    return NextResponse.json({ customers })
  } catch (error) {
    console.error("[v0] customers error:", error)
    return NextResponse.json(
      { error: "Failed to load customers" },
      { status: 500 },
    )
  }
}
