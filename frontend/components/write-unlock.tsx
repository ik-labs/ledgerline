"use client"

import { useEffect, useState } from "react"
import { Lock, LockOpen } from "lucide-react"
import {
  clearStoredKey,
  getStoredKey,
  setStoredKey,
} from "@/lib/client-write"

/**
 * Small header control to "unlock" the write actions (Simulate, Run test,
 * Run roll-up). Paste the write key once; it's held in sessionStorage for the
 * tab so the buttons never interrupt with a prompt. Cleared when the tab closes.
 */
export function WriteUnlock() {
  const [mounted, setMounted] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState("")

  useEffect(() => {
    setMounted(true)
    setUnlocked(!!getStoredKey())
  }, [])

  // Avoid hydration mismatch — render nothing until we've read sessionStorage.
  if (!mounted) return null

  if (unlocked) {
    return (
      <button
        onClick={() => {
          clearStoredKey()
          setUnlocked(false)
        }}
        title="Writes unlocked — click to lock"
        className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2.5 py-1 text-xs text-success transition-colors hover:bg-success/15"
      >
        <LockOpen className="h-3 w-3" />
        <span className="font-mono">writes unlocked</span>
      </button>
    )
  }

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const k = value.trim()
          if (k) {
            setStoredKey(k)
            setUnlocked(true)
            setEditing(false)
            setValue("")
          }
        }}
        className="flex items-center gap-1"
      >
        <input
          autoFocus
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => !value && setEditing(false)}
          placeholder="paste write key"
          className="w-36 rounded-md border border-border bg-background px-2 py-1 font-mono text-xs text-foreground outline-none focus:border-brand"
        />
        <button
          type="submit"
          className="rounded-md bg-brand px-2 py-1 text-xs font-medium text-brand-foreground hover:bg-brand/90"
        >
          Unlock
        </button>
      </form>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Paste the write key to enable Simulate / Run test / Roll-up"
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <Lock className="h-3 w-3" />
      <span className="font-mono">unlock writes</span>
    </button>
  )
}
