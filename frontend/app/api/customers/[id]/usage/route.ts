import { NextResponse } from "next/server"
import { getCustomerUsage } from "@/lib/repository"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const usage = await getCustomerUsage(id)
    if (!usage) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }
    return NextResponse.json(usage)
  } catch (error) {
    console.error("[v0] usage error:", error)
    return NextResponse.json(
      { error: "Failed to load usage" },
      { status: 500 },
    )
  }
}
