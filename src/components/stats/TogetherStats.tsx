import { Empty } from '@/components/stats/MeStats'
import PlaceBars from '@/components/stats/PlaceBars'
import UserIcon from '@/components/UserIcon'
import {
  daysAgo,
  formatDuration,
  formatRange,
  homeOf,
  placeColor,
  plural,
  type StatsPerson,
  type Together,
  together,
} from '@/lib/stats'

type Props = {
  people: StatsPerson[]
  viewerId: string
  meId: string
  from: number
  now: number
  periodText: string
  // The friend picked in the ranking (null = the default pick).
  withId: string | null
  onWithChange: (id: string) => void
}

const TogetherStats = ({
  people,
  viewerId,
  meId,
  from,
  now,
  periodText,
  withId,
  onWithChange,
}: Props) => {
  const viewer = people.find((p) => p.id === viewerId)!
  const who = (p: StatsPerson) => (p.id === meId ? 'You' : p.name)

  const ranking = people
    .filter((p) => p.id !== viewerId)
    .map((p) => ({ person: p, tg: together(viewer.stays, p.stays, from, now) }))
    .sort((a, b) => b.tg.total - a.tg.total)

  if (!ranking.length)
    return <Empty>No one else has logged anything yet.</Empty>

  const max = ranking[0].tg.total || 1
  // Your own pair first when looking at someone else's stats.
  const defaultId =
    viewerId !== meId && ranking.some((r) => r.person.id === meId)
      ? meId
      : ranking[0].person.id
  const selected =
    ranking.find((r) => r.person.id === withId) ??
    ranking.find((r) => r.person.id === defaultId)!
  // The signed-in user goes first, so the pair reads from their side.
  const [a, b] =
    selected.person.id === meId
      ? [selected.person, viewer]
      : [viewer, selected.person]
  const pairTitle = `${who(a)} & ${b.id === meId ? 'you' : b.name}`

  return (
    <div className="flex flex-col gap-6">
      <section className="card bg-base-200 shadow-md">
        <div className="card-body gap-4">
          <div>
            <h2 className="card-title">
              {viewerId === meId
                ? 'Who you spend the most time with'
                : `Who ${viewer.name} spends the most time with`}
            </h2>
            <p className="text-sm opacity-70">
              Time in the same city, {periodText}. Pick someone to see more.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            {ranking.map(({ person, tg }, i) => (
              <button
                key={person.id}
                type="button"
                aria-pressed={person.id === selected.person.id}
                onClick={() => onWithChange(person.id)}
                className={`rounded-field grid grid-cols-[1.25rem_2rem_minmax(0,1fr)_5.5rem] items-center gap-3 border px-3 py-2 text-left ${
                  person.id === selected.person.id
                    ? 'border-base-300 bg-base-100'
                    : 'hover:bg-base-300/50 border-transparent'
                }`}
              >
                <span className="text-center text-sm font-bold tabular-nums opacity-60">
                  {i + 1}
                </span>
                <UserIcon photoURL={person.photoURL} />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="flex items-center gap-2 truncate font-semibold">
                    {who(person)}
                    {person.id === meId && (
                      <span className="badge badge-neutral badge-xs">you</span>
                    )}
                  </span>
                  <span className="bg-base-300 h-2.5 overflow-hidden rounded-full">
                    <span
                      className="bg-base-content block h-full rounded-full"
                      style={{
                        width: `${tg.total ? Math.max(2, (tg.total / max) * 100) : 0}%`,
                      }}
                    />
                  </span>
                </span>
                <span className="text-right text-sm font-semibold tabular-nums">
                  {tg.total ? formatDuration(tg.total) : '—'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card bg-base-200 shadow-md">
        <div className="card-body gap-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                <UserIcon photoURL={a.photoURL} />
                <UserIcon photoURL={b.photoURL} />
              </div>
              <h2 className="card-title">{pairTitle}</h2>
            </div>
            <span className="badge">
              {formatDuration(selected.tg.total)} together
            </span>
          </div>
          {selected.tg.overlaps.length ? (
            <PairDetails
              tg={selected.tg}
              a={a}
              b={b}
              who={who}
              from={from}
              now={now}
            />
          ) : (
            <Empty>No time in the same city {periodText}.</Empty>
          )}
        </div>
      </section>
    </div>
  )
}

const PairDetails = ({
  tg,
  a,
  b,
  who,
  from,
  now,
}: {
  tg: Together
  a: StatsPerson
  b: StatsPerson
  who: (p: StatsPerson) => string
  from: number
  now: number
}) => {
  const last = tg.last!
  const longest = tg.longest!
  const isNow = last.end >= now - 60_000
  const lastText = daysAgo(last.end, now)

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Moment
          label="Last together"
          value={
            isNow ? 'Right now' : lastText[0].toUpperCase() + lastText.slice(1)
          }
          detail={
            isNow
              ? `Both in ${last.place.city}`
              : `${last.place.city} · ${formatRange(last.start, last.end)}`
          }
        />
        <Moment
          label="Longest stretch"
          value={formatDuration(longest.end - longest.start)}
          detail={`${longest.place.city} · ${formatRange(longest.start, longest.end)}`}
        />
        <Moment
          label="Times together"
          value={String(tg.overlaps.length)}
          detail={`in ${plural(tg.byPlace.length, 'city')}`}
        />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-wide uppercase opacity-70">
          Side by side
        </p>
        <Timeline tg={tg} a={a} b={b} who={who} from={from} now={now} />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-wide uppercase opacity-70">
          Cities together
        </p>
        <PlaceBars items={tg.byPlace.slice(0, 6)} format={formatDuration} />
      </div>
    </>
  )
}

const Moment = ({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) => (
  <div className="bg-base-100 rounded-field flex flex-col gap-0.5 px-4 py-3">
    <span className="text-xs font-semibold tracking-wide uppercase opacity-70">
      {label}
    </span>
    <span className="text-xl font-bold tabular-nums">{value}</span>
    <span className="text-xs opacity-80">{detail}</span>
  </div>
)

// Both people's stays as colored ribbons over the period, with the time they
// were in the same city highlighted between them.
const Timeline = ({
  tg,
  a,
  b,
  who,
  from: periodFrom,
  now,
}: {
  tg: Together
  a: StatsPerson
  b: StatsPerson
  who: (p: StatsPerson) => string
  from: number
  now: number
}) => {
  // Start when the first of the two began logging, if that's later.
  const firstLog = Math.min(
    a.entries[0]?.time ?? now,
    b.entries[0]?.time ?? now
  )
  const from = Math.max(periodFrom, firstLog)
  const span = Math.max(now - from, 1)
  const pos = (t: number) => ((Math.max(t, from) - from) / span) * 100

  const row = (p: StatsPerson) => {
    const home = homeOf(p.stays)
    return p.stays
      .filter((s) => s.end > from)
      .map((s) => (
        <span
          key={s.start}
          title={`${s.place.city} · ${formatRange(s.start, s.end)}`}
          className="absolute inset-y-0 min-w-0.5"
          style={{
            left: `${pos(s.start)}%`,
            width: `${pos(s.end) - pos(s.start)}%`,
            background:
              s.place.key === home?.key
                ? 'var(--color-base-300)'
                : placeColor(s.place),
          }}
        />
      ))
  }

  // Month ticks; only quarters when the range is long.
  const months = (now - from) / (30 * 86_400_000)
  const ticks: { t: number; text: string; minor: boolean }[] = []
  const d = new Date(from)
  for (
    let y = d.getFullYear(), m = d.getMonth() + 1;
    new Date(y, m, 1).getTime() < now;
    m++
  ) {
    const date = new Date(y, m, 1)
    const month = date.getMonth()
    const quarter = month % 3 === 0
    if (months > 15 && !quarter) continue
    ticks.push({
      t: date.getTime(),
      text:
        date.toLocaleDateString('en-GB', { month: 'short' }) +
        (month === 0 && months > 11 ? ` ${date.getFullYear()}` : ''),
      minor: !quarter,
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5">
        <span className="truncate text-right text-xs font-bold">{who(a)}</span>
        <div className="bg-base-100 relative h-6 overflow-hidden rounded-md">
          {row(a)}
        </div>
        <span className="text-right text-xs font-bold">Both</span>
        <div className="relative h-3">
          <span className="bg-base-300 absolute inset-x-0 top-1/2 h-px" />
          {tg.overlaps.map((o) => (
            <span
              key={o.start}
              title={`Together in ${o.place.city} · ${formatRange(o.start, o.end)}`}
              className="bg-base-content absolute inset-y-0 min-w-0.5 rounded-sm"
              style={{
                left: `${pos(o.start)}%`,
                width: `${pos(o.end) - pos(o.start)}%`,
              }}
            />
          ))}
        </div>
        <span className="truncate text-right text-xs font-bold">{who(b)}</span>
        <div className="bg-base-100 relative h-6 overflow-hidden rounded-md">
          {row(b)}
        </div>
        <span />
        <div className="relative h-5 text-[0.6875rem] opacity-70">
          {ticks.map((tick) => (
            <span
              key={tick.t}
              className={`border-base-300 absolute top-0 border-l pl-1 leading-5 whitespace-nowrap ${tick.minor ? 'max-sm:hidden' : ''}`}
              style={{ left: `${pos(tick.t)}%` }}
            >
              {tick.text}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <Swatch color="var(--color-base-300)">Home</Swatch>
        <Swatch color="var(--color-base-content)">Together</Swatch>
        {tg.byPlace.map(({ place }) => (
          <Swatch key={place.key} color={placeColor(place)}>
            {place.city}
          </Swatch>
        ))}
      </div>
    </div>
  )
}

const Swatch = ({
  color,
  children,
}: {
  color: string
  children: React.ReactNode
}) => (
  <span className="inline-flex items-center gap-1.5">
    <span className="h-3 w-3 rounded-sm" style={{ background: color }} />
    {children}
  </span>
)

export default TogetherStats
