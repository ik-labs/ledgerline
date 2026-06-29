import { NextResponse } from "next/server"
import { checkWriteAuth } from "@/lib/auth"
import {
  addEndpoint,
  deleteEndpoint,
  isSafeWebhookUrl,
  listDeliveries,
  listEndpoints,
  urlIsDeliverable,
} from "@/lib/webhooks"

export const dynamic = "force-dynamic"

export async function GET() {
  const [endpoints, deliveries] = await Promise.all([
    listEndpoints(),
    listDeliveries(),
  ])
  return NextResponse.json({ endpoints, deliveries })
}

export async function POST(request: Request) {
  const denied = checkWriteAuth(request)
  if (denied) return denied

  let body: { url?: string; description?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  // Syntactic pre-filter, then DNS-resolved authoritative check.
  if (!body.url || !isSafeWebhookUrl(body.url) || !(await urlIsDeliverable(body.url))) {
    return NextResponse.json(
      { error: "a public http(s) URL is required (private/loopback/internal blocked)" },
      { status: 400 },
    )
  }
  await addEndpoint(body.url, body.description)
  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function DELETE(request: Request) {
  const denied = checkWriteAuth(request)
  if (denied) return denied
  const id = new URL(request.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  await deleteEndpoint(id)
  return NextResponse.json({ ok: true })
}
