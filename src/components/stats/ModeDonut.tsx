import TravelModeIcon from '@/components/TravelModeIcon'
import { formatKm, type Leg, MODE_COLORS } from '@/lib/stats'
import { TRAVEL_MODES, TravelMode } from '@/lib/travel'

type Props = {
  legs: Leg[]
  by: 'trips' | 'km'
}

const R = 46
const label = (mode: TravelMode) =>
  TRAVEL_MODES.find((m) => m.value === mode)?.label ?? 'Other'

// Donut of travel modes, by number of trips or by kilometres.
const ModeDonut = ({ legs, by }: Props) => {
  const totals = new Map<TravelMode, number>()
  for (const l of legs)
    totals.set(l.mode, (totals.get(l.mode) ?? 0) + (by === 'trips' ? 1 : l.km))
  const modes = [...totals].sort((a, b) => b[1] - a[1])
  const sum = modes.reduce((n, [, v]) => n + v, 0)
  if (!sum) return null

  const [topMode, topValue] = modes[0]
  const topPct = Math.round((topValue / sum) * 100)
  // Where each slice starts, as a percentage of the circle.
  const starts = modes.map((_, i) =>
    modes.slice(0, i).reduce((n, [, v]) => n + (v / sum) * 100, 0)
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-5">
        <svg
          viewBox="0 0 120 120"
          className="h-36 w-36 shrink-0"
          role="img"
          aria-label={`Mostly ${label(topMode)}, ${topPct}%`}
        >
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            strokeWidth="16"
            className="stroke-base-300"
          />
          {modes.map(([mode, v], i) => {
            const pct = (v / sum) * 100
            // A small gap between slices, unless there's only one.
            const shown = modes.length > 1 ? Math.max(pct - 0.8, 0.4) : 100
            return (
              <circle
                key={mode}
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke={MODE_COLORS[mode]}
                strokeWidth="16"
                pathLength={100}
                strokeDasharray={`${shown} ${100 - shown}`}
                strokeDashoffset={25 - starts[i]}
              >
                <title>{`${label(mode)}: ${Math.round(pct)}%`}</title>
              </circle>
            )
          })}
          <text
            x="60"
            y="68"
            textAnchor="middle"
            fontSize="20"
            fontWeight="700"
            className="fill-base-content"
          >
            {topPct}%
          </text>
        </svg>
        <ul className="flex min-w-36 flex-1 flex-col gap-1.5 text-sm">
          {modes.map(([mode, v]) => (
            <li
              key={mode}
              className="grid grid-cols-[0.75rem_1.5rem_1fr_auto] items-center gap-1.5"
            >
              <span
                className="h-3 w-3 rounded-sm"
                style={{ background: MODE_COLORS[mode] }}
              />
              <TravelModeIcon mode={mode} />
              <span>{label(mode)}</span>
              <span className="tabular-nums">
                {by === 'trips' ? v : formatKm(v)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-sm opacity-70">
        Mostly {label(topMode).toLowerCase()}: {topPct}% of{' '}
        {by === 'trips' ? 'trips' : 'kilometres'}.
      </p>
    </div>
  )
}

export default ModeDonut
