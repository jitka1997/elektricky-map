import Link from 'next/link'

import ModeDonut from '@/components/stats/ModeDonut'
import PlaceBars from '@/components/stats/PlaceBars'
import Toggle from '@/components/stats/Toggle'
import { describeRecord } from '@/lib/records'
import {
  daysAgo,
  formatDays,
  formatKm,
  type PersonStats,
  plural,
} from '@/lib/stats'
import { type RecordId, RECORDS } from '@/lib/statsParams'

type Props = {
  stats: PersonStats
  // null when looking at your own stats.
  name: string | null
  periodWord: string
  now: number
  rankBy: 'time' | 'visits'
  modeBy: 'trips' | 'km'
  onRankByChange: (value: 'time' | 'visits') => void
  onModeByChange: (value: 'trips' | 'km') => void
  // Link to the map showing a record.
  recordHref: (id: RecordId) => string
}

const TOP_PLACES = 8

const MeStats = ({
  stats: st,
  name,
  periodWord,
  now,
  rankBy,
  modeBy,
  onRankByChange,
  onModeByChange,
  recordHref,
}: Props) => {
  // Home dwarfs everything else, so it gets its own line and the bars compare
  // the places away from home.
  const ranked = rankBy === 'time' ? st.time : st.visits
  const homeValue = ranked.find((t) => t.place.key === st.home?.key)?.value
  const away = ranked.filter((t) => t.place.key !== st.home?.key)
  const top = away.slice(0, TOP_PLACES)
  const format =
    rankBy === 'time' ? formatDays : (v: number) => plural(v, 'visit')

  const records = RECORDS.flatMap((id) => {
    const text = describeRecord(id, st, periodWord, name)
    return text ? [{ id, ...text }] : []
  })

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Headline
          label="Cities"
          value={String(st.placeCount)}
          detail={`in ${plural(st.countryCount, 'country')}`}
        />
        <Headline
          label="Travelled"
          value={formatKm(st.km)}
          detail={`${st.aroundEarth.toFixed(2)}× around the Earth`}
        />
        <Headline
          label="Away from home"
          value={formatDays(st.away)}
          detail={`${st.tracked ? Math.round((st.away / st.tracked) * 100) : 0}% of the time ${periodWord}`}
        />
        <Headline
          label="Entries"
          value={String(st.entryCount)}
          detail={
            st.lastEntry
              ? `Last: ${st.lastEntry.place.city}, ${daysAgo(st.lastEntry.time, now)}`
              : ''
          }
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="card bg-base-200 min-w-0 shadow-md">
          <div className="card-body gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="card-title">
                {name
                  ? `Where ${name} spent time`
                  : 'Where you spent your time'}
              </h2>
              <Toggle
                label="Rank cities by"
                value={rankBy}
                options={[
                  ['time', 'By time'],
                  ['visits', 'By visits'],
                ]}
                onChange={onRankByChange}
              />
            </div>
            {st.home && homeValue !== undefined && (
              <div className="bg-base-100 rounded-field flex flex-wrap items-baseline gap-x-2 gap-y-1 px-3 py-2 text-sm">
                <span className="font-semibold">{st.home.city}</span>
                <span className="badge badge-sm">home</span>
                <span className="tabular-nums">
                  {format(homeValue)}
                  {rankBy === 'time' &&
                    st.tracked > 0 &&
                    ` · ${Math.round((homeValue / st.tracked) * 100)}% of the time`}
                </span>
              </div>
            )}
            <p className="text-xs font-semibold tracking-wide uppercase opacity-70">
              Away from home
            </p>
            {top.length ? (
              <PlaceBars items={top} format={format} />
            ) : (
              <Empty>No trips {periodWord}.</Empty>
            )}
            {away.length > top.length && (
              <p className="text-xs opacity-70">
                and {plural(away.length - top.length, 'more city')}
              </p>
            )}
          </div>
        </section>

        <section className="card bg-base-200 min-w-0 shadow-md">
          <div className="card-body gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="card-title">
                {name ? `How ${name} travels` : 'How you travel'}
              </h2>
              <Toggle
                label="Count travel by"
                value={modeBy}
                options={[
                  ['trips', 'Trips'],
                  ['km', 'Km'],
                ]}
                onChange={onModeByChange}
              />
            </div>
            {st.legs.length ? (
              <ModeDonut legs={st.legs} by={modeBy} />
            ) : (
              <Empty>No trips {periodWord}.</Empty>
            )}
          </div>
        </section>
      </div>

      <section className="card bg-base-200 shadow-md">
        <div className="card-body gap-2">
          <h2 className="card-title">Records</h2>
          <div className="grid gap-x-5 sm:grid-cols-2 lg:grid-cols-3">
            {records.map((r) => (
              <div
                key={r.id}
                // "Back to stats" from the map scrolls here; the margin keeps
                // it clear of the fixed navbar.
                id={`record-${r.id}`}
                className="border-base-300 flex scroll-mt-24 flex-col gap-0.5 border-t py-4"
              >
                <span className="text-xs font-semibold tracking-wide uppercase opacity-70">
                  {r.label}
                </span>
                <span className="text-xl font-bold tabular-nums">
                  {r.value}
                </span>
                <span className="text-sm opacity-80">{r.detail}</span>
                {r.value !== '0' && (
                  <Link
                    href={recordHref(r.id)}
                    className="link mt-1 self-start text-sm font-semibold"
                  >
                    Show on map
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

const Headline = ({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) => (
  <div className="card bg-base-200 shadow-md">
    <div className="card-body gap-0.5 p-4 sm:p-5">
      <span className="text-xs font-semibold tracking-wide uppercase opacity-70">
        {label}
      </span>
      <span className="text-2xl font-bold tabular-nums sm:text-3xl">
        {value}
      </span>
      <span className="text-xs opacity-70">{detail}</span>
    </div>
  </div>
)

export const Empty = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-base-100 rounded-field p-6 text-center text-sm opacity-70">
    {children}
  </div>
)

export default MeStats
