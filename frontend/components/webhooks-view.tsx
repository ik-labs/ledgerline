"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Loader2, Send, Trash2, Webhook } from "lucide-react"
import { Button } from "@/components/ui/button"
import { postWrite, getStoredKey } from "@/lib/client-write"
import { formatRelativeTime } from "@/lib/format"
import type { WebhookDelivery, WebhookEndpoint } from "@/lib/webhooks"

const fetcher = (u: string) => fetch(u).then((r) => r.json())

function StatusPill({ status, code }: { status: string; code: number | null }) {
  const tone =
    status === "success"
      ? "border-success/40 text-success"
      : status === "blocked"
        ? "border-warning/40 text-warning"
        : "border-destructive/40 text-destructive"
  return (
    <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${tone}`}>
      {status}
      {code != null ? ` · ${code}` : ""}
    </span>
  )
}

export function WebhooksView() {
  const { data, mutate } = useSWR<{
    endpoints: WebhookEndpoint[]
    deliveries: WebhookDelivery[]
  }>("/api/webhooks", fetcher, { refreshInterval: 3000 })

  const [url, setUrl] = useState("")
  const [desc, setDesc] = useState("")
  const [busy, setBusy] = useState(false)

  async function add() {
    if (!url.trim()) return
    setBusy(true)
    try {
      const res = await postWrite("/api/webhooks", { url: url.trim(), description: desc.trim() })
      if (!res.ok) throw new Error((await res.json()).error)
      setUrl("")
      setDesc("")
      mutate()
      toast.success("Endpoint added")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add endpoint")
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    const key = getStoredKey()
    const res = await fetch(`/api/webhooks?id=${id}`, {
      method: "DELETE",
      headers: key ? { "x-api-key": key } : {},
    })
    if (res.ok) mutate()
    else toast.error("Unlock writes to delete")
  }

  async function sendTest() {
    setBusy(true)
    try {
      const res = await postWrite("/api/webhooks/test", {})
      if (!res.ok) throw new Error()
      setTimeout(mutate, 600)
      toast.success("Test event sent")
    } catch {
      toast.error("Failed to send test")
    } finally {
      setBusy(false)
    }
  }

  const endpoints = data?.endpoints ?? []
  const deliveries = data?.deliveries ?? []

  return (
    <div className="flex flex-col gap-6">
      {/* Add + endpoints */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Webhook className="h-4 w-4 text-brand" />
            <h2 className="text-sm font-medium text-foreground">Endpoints</h2>
          </div>
          <Button size="sm" variant="outline" onClick={sendTest} disabled={busy || endpoints.length === 0}>
            <Send className="h-3.5 w-3.5" />
            Send test event
          </Button>
        </div>

        <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://webhook.site/your-url"
            className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-sm outline-none focus:border-brand"
          />
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="description (optional)"
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-brand sm:w-48"
          />
          <Button size="sm" onClick={add} disabled={busy} className="bg-brand text-brand-foreground hover:bg-brand/90">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Add
          </Button>
        </div>

        {endpoints.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No endpoints. Add one (try a free URL from webhook.site) and run a
            roll-up or send a test event.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {endpoints.map((ep) => (
              <li key={ep.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-mono text-xs text-foreground">{ep.url}</span>
                  {ep.description && (
                    <span className="truncate text-xs text-muted-foreground">{ep.description}</span>
                  )}
                </div>
                <button
                  onClick={() => remove(ep.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  title="Delete endpoint"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Deliveries log */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium text-foreground">Recent deliveries</h2>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            live
          </span>
        </div>
        {deliveries.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No deliveries yet. Add an endpoint, then send a test event or run a roll-up.
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Event</th>
                <th className="hidden px-4 py-2 font-medium sm:table-cell">Endpoint</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-2.5 font-mono text-xs text-foreground">{d.eventType}</td>
                  <td className="hidden max-w-[260px] truncate px-4 py-2.5 font-mono text-xs text-muted-foreground sm:table-cell">
                    {d.url}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusPill status={d.status} code={d.statusCode} />
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground">
                    {formatRelativeTime(d.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
