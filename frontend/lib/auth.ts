import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"

/**
 * Write-path authorization for Ledgerline.
 *
 * Threat model: the app is deployed at a public URL. We must stop anonymous
 * internet traffic from writing to the ledger.
 *
 *   - /api/ingest accepts arbitrary external input (customer_id, metric,
 *     quantity) -> the real data plane. It REQUIRES a shared-secret header
 *     (x-api-key === INGEST_API_KEY). External producers send this header.
 *
 *   - /api/simulate and /api/rollup take NO external input (they operate on the
 *     already-seeded customers) and are triggered by the in-app demo buttons.
 *     They accept the key OR a same-origin request, so the browser buttons work
 *     without the secret ever reaching the client bundle.
 *
 * If INGEST_API_KEY is unset (local/preview), everything is open for convenience.
 */

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

interface AuthOpts {
  allowSameOrigin?: boolean
}

/**
 * Returns a 401/403 response if the request is not authorized, or null if it is.
 */
export function checkWriteAuth(
  req: Request,
  { allowSameOrigin = false }: AuthOpts = {},
): NextResponse | null {
  const expected = process.env.INGEST_API_KEY

  // No key configured -> open (local dev / preview before a key is set).
  if (!expected) return null

  // A valid API key always authorizes.
  const provided = req.headers.get("x-api-key")
  if (provided && safeEqual(provided, expected)) return null

  // In-app admin/demo routes: allow same-origin browser requests.
  if (allowSameOrigin) {
    const host = req.headers.get("host")
    const origin = req.headers.get("origin")
    if (host && origin) {
      try {
        if (new URL(origin).host === host) return null
      } catch {
        // malformed Origin -> fall through to deny
      }
    }
  }

  return NextResponse.json({ error: "unauthorized" }, { status: 401 })
}
