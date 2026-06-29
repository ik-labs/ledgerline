import { NextResponse } from "next/server"
import { getCustomerEvents } from "@/lib/repository"

export const dynamic = "force-dynamic"

/** GET /api/customers/:id/events — full append-only event log (read-only). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const events = await getCustomerEvents(id)
  return NextResponse.json({ events, count: events.length })
}
