"use client"

import useSWR from "swr"
import { Activity } from "lucide-react"

const fetcher = (u: string) => fetch(u).then((r) => r.json())

interface Health {
  queue: { depth: number | null; inFlight: number | null; configured: boolean }
  ledger: { totalEvents: number | null; eventsLastMinute: number | null }
}

function fmt(v: number | null | undefined): string {
  return v == null ? "—" : v.toLocaleString()
}

function Cell({
  label,
  value,
  hint,
  emphasize,
}: {
  label: string
  value: string
  hint: string
  emphasize?: boolean
}) {
  return (
    <div className="bg-card px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`mt-1 font-mono text-lg font-semibold tabular-nums ${
          emphasize ? "text-brand" : "text-foreground"
        }`}
      >
        {value}
      </dd>
      <dd className="mt-0.5 font-mono text-[10px] text-muted-foreground">{hint}</dd>
    </div>
  )
}

export function PipelineHealth() {
  const { data } = useSWR<Health>("/api/health", fetcher, {
    refreshInterval: 3000,
  })
  const q = data?.queue
  const l = data?.ledger

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-brand" />
          <h2 className="text-sm font-medium text-foreground">Ingest pipeline</h2>
          <span className="font-mono text-xs text-muted-foreground">
            SQS → drainer → DSQL
          </span>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
          </span>
          live
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        <Cell label="Queue depth" value={fmt(q?.depth)} hint="buffered on SQS" emphasize />
        <Cell label="In flight" value={fmt(q?.inFlight)} hint="being drained" />
        <Cell label="Events / min" value={fmt(l?.eventsLastMinute)} hint="committed to DSQL" />
        <Cell label="Ledger events" value={fmt(l?.totalEvents)} hint="total this cluster" />
      </dl>
    </div>
  )
}
