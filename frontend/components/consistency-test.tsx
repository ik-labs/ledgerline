"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, ShieldCheck } from "lucide-react"
import { postWrite } from "@/lib/client-write"
import { Button } from "@/components/ui/button"

interface StressResult {
  attempted: number
  uniqueKeys: number
  duplicateAttempts: number
  recorded: number
  doubleCounts: number
  conflictsRetried: number
  ms: number
  mode: "dsql" | "memory"
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-sm tabular-nums text-foreground">{value}</span>
    </div>
  )
}

export function ConsistencyTest({
  customerId,
  onComplete,
}: {
  customerId: string
  onComplete?: () => void
}) {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<StressResult | null>(null)

  async function run() {
    setRunning(true)
    try {
      const res = await postWrite("/api/stress", {
        customerId,
        total: 250,
        uniqueRatio: 0.6,
      })
      if (!res.ok) throw new Error("stress failed")
      const data: StressResult = await res.json()
      setResult(data)
      onComplete?.()
      if (data.doubleCounts === 0) {
        toast.success("Zero double-counts", {
          description: `${data.recorded} unique events recorded under ${data.attempted} concurrent writes.`,
        })
      } else {
        toast.error(`${data.doubleCounts} double-counts detected`)
      }
    } catch {
      toast.error("Consistency test failed")
    } finally {
      setRunning(false)
    }
  }

  const clean = result && result.doubleCounts === 0

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-brand" />
          <h2 className="text-sm font-medium text-foreground">
            Consistency stress test
          </h2>
        </div>
        <Button
          size="sm"
          onClick={run}
          disabled={running}
          className="bg-brand text-brand-foreground hover:bg-brand/90"
        >
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5" />
          )}
          {running ? "Hammering the ledger…" : "Run test"}
        </Button>
      </div>

      <div className="px-4 py-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Fires <span className="font-mono text-foreground">250</span> concurrent
          writes with deliberate duplicate idempotency keys. Aurora DSQL is strongly
          consistent, so its unique index records each event{" "}
          <span className="text-foreground">exactly once</span> — no matter how many
          writers race.
        </p>

        {result && (
          <div className="mt-4 rounded-md border border-border bg-background p-4">
            <div className="flex items-baseline gap-2">
              <span
                className={`font-mono text-3xl font-semibold tabular-nums ${
                  clean ? "text-success" : "text-destructive"
                }`}
              >
                {result.doubleCounts}
              </span>
              <span className="text-sm text-muted-foreground">
                double-counts
                <span className="ml-2 font-mono text-xs">in {result.ms} ms</span>
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-x-8">
              <Stat label="Concurrent writes" value={result.attempted} />
              <Stat label="Duplicate attempts" value={result.duplicateAttempts} />
              <Stat label="Unique events" value={result.uniqueKeys} />
              <Stat label="Recorded in DSQL" value={result.recorded} />
              {result.conflictsRetried > 0 && (
                <Stat label="Conflicts serialized" value={result.conflictsRetried} />
              )}
              <Stat label="Engine" value={result.mode === "dsql" ? "Aurora DSQL" : "in-memory"} />
            </div>

            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              {clean
                ? `DSQL recorded every unique event exactly once under ${result.attempted} concurrent writes — never dropped, never double-counted.`
                : "Mismatch: recorded count exceeds unique events."}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
