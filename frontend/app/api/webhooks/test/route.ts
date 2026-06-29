import { NextResponse } from "next/server"
import { checkWriteAuth } from "@/lib/auth"
import { deliverWebhooks } from "@/lib/webhooks"

export const dynamic = "force-dynamic"

/** POST /api/webhooks/test — fire a sample event to all active endpoints. */
export async function POST(request: Request) {
  const denied = checkWriteAuth(request)
  if (denied) return denied
  await deliverWebhooks("ping", { message: "Ledgerline test event" })
  return NextResponse.json({ ok: true })
}
