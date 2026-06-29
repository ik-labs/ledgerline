import { isDatabaseConnected } from "@/lib/db/client"

export function DbBanner() {
  if (isDatabaseConnected) return null
  return (
    <div className="border-b border-border bg-muted/50">
      <div className="mx-auto max-w-6xl px-4 py-2 sm:px-6">
        <p className="font-mono text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Preview mode</span>
          {" — no "}
          <code className="rounded bg-background px-1 py-0.5">DATABASE_URL</code>
          {
            " set, using in-memory sample data. Set DATABASE_URL (or wire the DSQL connection layer) for persistence."
          }
        </p>
      </div>
    </div>
  )
}
