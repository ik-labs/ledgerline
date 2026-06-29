"use client"

import useSWR from "swr"
import { History } from "lucide-react"
import { describeEvent, formatRelativeTime } from "@/lib/format"

const fetcher = (u: string) => fetch(u).then((r) => r.json())

interface AuditEvent {
  id: string
  metric: string
  quantity: number
  eventTime: string
  idempotencyKey: string
}

export function AuditTrail({ customerId }: { customerId: string }) {
  const { data } = useSWR<{ events: AuditEvent[]; count: number }>(
    `/api/customers/${customerId}/events`,
    fetcher,
    { refreshInterval: 5000 },
  )
  const events = data?.events ?? []

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-brand" />
          <h2 className="text-sm font-medium text-foreground">Audit trail</h2>
          <span className="font-mono text-xs text-muted-foreground">
            append-only · immutable
          </span>
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {data?.count ?? 0} events
        </span>
      </div>
      {events.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          No events recorded yet.
        </p>
      ) : (
        <ul className="max-h-80 divide-y divide-border overflow-y-auto">
          {events.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-3 px-4 py-2"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm text-foreground">
                  {describeEvent(e.metric, Number(e.quantity))}
                </span>
                <span className="truncate font-mono text-[10px] text-muted-foreground">
                  {e.idempotencyKey}
                </span>
              </div>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {formatRelativeTime(e.eventTime)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
