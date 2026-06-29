import { NextResponse } from "next/server"
import { runConsistencyTest } from "@/lib/stress"
import { checkWriteAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"
// concurrent burst can take a few seconds
export const maxDuration = 60

/**
 * POST /api/stress — run the consistency stress test for a customer.
 * Body: { customerId, total?, uniqueRatio? }
 */
export async function POST(request: Request) {
  const denied = checkWriteAuth(request)
  if (denied) return denied

  let body: { customerId?: string; total?: number; uniqueRatio?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  if (!body.customerId) {
    return NextResponse.json({ error: "customerId is required" }, { status: 400 })
  }

  try {
    const result = await runConsistencyTest(body.customerId, {
      total: body.total,
      uniqueRatio: body.uniqueRatio,
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error("[stress] error:", error)
    return NextResponse.json({ error: "Stress test failed" }, { status: 500 })
  }
}
