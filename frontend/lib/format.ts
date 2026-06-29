const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Format integer cents as a USD currency string. */
export function formatCents(cents: number): string {
  return currency.format((cents ?? 0) / 100)
}

const compactNumber = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
})

export function formatQuantity(quantity: number): string {
  return compactNumber.format(quantity ?? 0)
}

const METRIC_LABELS: Record<string, string> = {
  api_call: "API calls",
  gb_stored: "GB stored",
  seat: "Seats",
  compute_ms: "Compute (ms)",
  egress_gb: "Egress (GB)",
}

export function metricLabel(metric: string): string {
  return METRIC_LABELS[metric] ?? metric
}

/** Human, plain-language description of a usage event. */
export function describeEvent(metric: string, quantity: number): string {
  const q = formatQuantity(quantity)
  switch (metric) {
    case "api_call":
      return `${q} API ${quantity === 1 ? "call" : "calls"}`
    case "gb_stored":
      return `${q} GB stored`
    case "seat":
      return `${q} ${quantity === 1 ? "seat" : "seats"} provisioned`
    case "compute_ms":
      return `${q} ms compute`
    case "egress_gb":
      return `${q} GB egress`
    default:
      return `${q} ${metric}`
  }
}

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diff = Math.max(0, now - then)
  const seconds = Math.floor(diff / 1000)
  if (seconds < 5) return "just now"
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function formatPeriod(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const sameYear = s.getFullYear() === e.getFullYear()
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
  const startStr = s.toLocaleDateString("en-US", opts)
  const endStr = e.toLocaleDateString("en-US", {
    ...opts,
    year: sameYear ? undefined : "numeric",
  })
  return `${startStr} – ${endStr}, ${e.getFullYear()}`
}
