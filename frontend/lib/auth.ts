import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"

/**
 * Write-path authorization for Ledgerline.
 *
 * The app is deployed at a public URL, so every endpoint that mutates the ledger
 * REQUIRES a shared-secret header: `x-api-key === INGEST_API_KEY`.
 *
 * We deliberately do NOT trust Origin/Host/Referer — those are client-controlled
 * and trivially spoofable by a non-browser client, so same-origin is not auth.
 * The in-app demo buttons obtain the key from the operator at runtime (prompt ->
 * sessionStorage; see lib/client-write.ts), so the secret is never shipped in the
 * client bundle.
 *
 * If INGEST_API_KEY is unset (local/preview), the write endpoints are open for
 * convenience.
 */

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/** Returns a 401 response if the request is not authorized, or null if it is. */
export function checkWriteAuth(req: Request): NextResponse | null {
  const expected = process.env.INGEST_API_KEY

  // No key configured -> open (local dev / preview before a key is set).
  if (!expected) return null

  const provided = req.headers.get("x-api-key")
  if (provided && safeEqual(provided, expected)) return null

  return NextResponse.json({ error: "unauthorized" }, { status: 401 })
}
