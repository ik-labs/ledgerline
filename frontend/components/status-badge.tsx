import { cn } from "@/lib/utils"
import type { CustomerStatus } from "@/lib/types"

const CONFIG: Record<
  CustomerStatus,
  { label: string; dot: string; text: string }
> = {
  ok: {
    label: "On track",
    dot: "bg-success",
    text: "text-muted-foreground",
  },
  approaching: {
    label: "Near limit",
    dot: "bg-warning",
    text: "text-foreground",
  },
  over: {
    label: "Over limit",
    dot: "bg-destructive",
    text: "text-destructive",
  },
}

export function StatusBadge({
  status,
  className,
}: {
  status: CustomerStatus
  className?: string
}) {
  const c = CONFIG[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs whitespace-nowrap",
        c.text,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {c.label}
    </span>
  )
}
