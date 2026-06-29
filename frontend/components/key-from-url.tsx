"use client"

import { useEffect } from "react"
import { toast } from "sonner"
import { getStoredKey, setStoredKey } from "@/lib/client-write"

/**
 * Magic-link write access for reviewers.
 *
 * Give judges a URL with the write key:
 *     https://<app>/?key=<INGEST_API_KEY>      (also accepts a bare ?<key>)
 *
 * On load we capture the key into localStorage (so writes stay unlocked across
 * reloads/tabs), strip it from the address bar, and confirm with a toast. The
 * general public gets the bare domain -> no key -> read-only.
 *
 * This is a client-held demo token, not a real credential: it only enables the
 * same write actions the in-app buttons expose, and the data is disposable.
 */

const KEY_RE = /^[A-Za-z0-9_-]{16,128}$/

export function KeyFromUrl() {
  useEffect(() => {
    const { pathname, search, hash } = window.location
    const params = new URLSearchParams(search)

    let key = params.get("key") ?? params.get("k")
    if (key) {
      params.delete("key")
      params.delete("k")
    } else {
      // bare ?<key> form
      const raw = search.replace(/^\?/, "")
      if (raw && !raw.includes("=") && KEY_RE.test(raw)) {
        key = raw
        for (const k of [...params.keys()]) params.delete(k)
      }
    }

    if (!key || !KEY_RE.test(key)) return

    const already = getStoredKey() === key
    setStoredKey(key)

    // Remove the key from the URL so it isn't left in the address bar / history.
    const qs = params.toString()
    window.history.replaceState(
      {},
      "",
      pathname + (qs ? `?${qs}` : "") + hash,
    )

    if (!already) {
      toast.success("Write access enabled", {
        description: "Simulate, consistency test, and roll-up are unlocked.",
      })
    }
  }, [])

  return null
}
