import type { DailyPoint } from "@/lib/types"

/**
 * Lightweight, dependency-free SVG charts in the financial-product aesthetic.
 * Theme-aware via `currentColor` (set the colour with a text-* class).
 */

export function SpendAreaChart({
  data,
  projectedCents,
  progress,
}: {
  data: DailyPoint[]
  projectedCents?: number
  progress?: number // fraction of cycle elapsed (0..1)
}) {
  const width = 600
  const height = 140
  const padX = 2
  const padTop = 10
  const padBottom = 2
  const inner = width - 2 * padX

  if (data.length === 0) return null

  const n = data.length
  const lastActual = data[n - 1].cents
  const showForecast =
    projectedCents != null &&
    progress != null &&
    progress < 0.999 &&
    projectedCents > lastActual

  const max = Math.max(lastActual, showForecast ? projectedCents! : 0, 1)
  // Actual series spans the elapsed fraction of the cycle width.
  const actualSpan = showForecast ? progress! * inner : inner
  const x = (i: number) =>
    n === 1 ? padX : padX + (i / (n - 1)) * actualSpan
  const y = (c: number) =>
    height - padBottom - (c / max) * (height - padTop - padBottom)

  const line = data.map((d, i) => `${x(i)},${y(d.cents)}`).join(" ")
  const area = `${x(0)},${height - padBottom} ${line} ${x(n - 1)},${height - padBottom}`
  const lastX = x(n - 1)
  const lastY = y(lastActual)

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-36 w-full text-brand"
      role="img"
      aria-label="Cumulative spend this cycle with end-of-cycle forecast"
    >
      <polygon points={area} fill="currentColor" fillOpacity="0.12" />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {showForecast && (
        <>
          <line
            x1={lastX}
            y1={lastY}
            x2={padX + inner}
            y2={y(projectedCents!)}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            strokeOpacity="0.6"
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={padX + inner}
            cy={y(projectedCents!)}
            r="2.5"
            fill="currentColor"
            fillOpacity="0.6"
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
      <circle cx={lastX} cy={lastY} r="3" fill="currentColor" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** A thin proportional bar (0..1) for inline use in tables. */
export function MiniBar({ fraction }: { fraction: number }) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
      <div
        className="h-full rounded-full bg-brand"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
