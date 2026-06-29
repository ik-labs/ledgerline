"use client"

/**
 * Client helper for the in-app admin/demo write buttons (Simulate, Run roll-up).
 *
 * The write endpoints require the x-api-key header. We never bundle that secret;
 * instead the operator provides it once at runtime. Flow:
 *   1. Send the request (with a cached key if we already have one).
 *   2. If the server enforces a key and we don't have a valid one (401), prompt
 *      the operator, cache it in sessionStorage (cleared when the tab closes),
 *      and retry.
 * In local/preview mode (no key configured server-side) the first call succeeds
 * and the operator is never prompted.
 */

export const WRITE_KEY_STORAGE = "ledgerline_api_key"

export function getStoredKey(): string | null {
  return typeof window !== "undefined"
    ? sessionStorage.getItem(WRITE_KEY_STORAGE)
    : null
}
export function setStoredKey(key: string): void {
  if (typeof window !== "undefined")
    sessionStorage.setItem(WRITE_KEY_STORAGE, key)
}
export function clearStoredKey(): void {
  if (typeof window !== "undefined")
    sessionStorage.removeItem(WRITE_KEY_STORAGE)
}

export async function postWrite(url: string, body: unknown): Promise<Response> {
  const json = JSON.stringify(body)
  const headers: Record<string, string> = { "Content-Type": "application/json" }

  const saved = getStoredKey()
  if (saved) headers["x-api-key"] = saved

  let res = await fetch(url, { method: "POST", headers, body: json })

  if (res.status === 401 && typeof window !== "undefined") {
    const key = window
      .prompt("Enter the Ledgerline write key (x-api-key):")
      ?.trim()
    if (!key) return res
    setStoredKey(key)
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: json,
    })
    if (res.status === 401) clearStoredKey() // bad key, don't cache
  }

  return res
}
