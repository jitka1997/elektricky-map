'use client'

import { useRouter } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'

import Container from '@/components/Container'
import MeStats, { Empty } from '@/components/stats/MeStats'
import TogetherStats from '@/components/stats/TogetherStats'
import Toggle from '@/components/stats/Toggle'
import { useAuth } from '@/lib/AuthContext'
import { useLocations } from '@/lib/LocationContext'
import { periodStart, personStats, toPeople } from '@/lib/stats'
import { statsQuery, useStatsView } from '@/lib/statsParams'

const Spinner = () => (
  <div className="flex h-screen items-center justify-center">
    <span className="loading loading-spinner loading-lg"></span>
  </div>
)

const StatsView = () => {
  const { user, loading } = useAuth()
  const { locationData, isLoading } = useLocations()
  const router = useRouter()
  const { view, params, update } = useStatsView()

  // Fixed for the visit, so every number is measured to the same moment.
  const [now] = useState(() => Date.now())

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [loading, user, router])

  const people = useMemo(() => toPeople(locationData, now), [locationData, now])

  if (loading || isLoading || !user) return <Spinner />

  const year = new Date(now).getFullYear()
  const from = periodStart(view.period, now)
  const viewer =
    people.find((p) => p.id === (view.user ?? user.uid)) ??
    people.find((p) => p.id === user.uid)
  const isMe = viewer?.id === user.uid

  // The map link keeps the whole stats view, so "Back to stats" (or the
  // browser's Back) returns to exactly this.
  const recordHref = (record: string) =>
    `/${statsQuery(params, { record, user: viewer?.id ?? null })}`

  return (
    <Container className="text-base-content flex flex-col gap-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-bold">Stats</h1>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            Stats for
            <select
              className="select select-sm w-auto font-semibold"
              value={viewer?.id ?? user.uid}
              // Another person is a new view: Back returns to the previous one.
              onChange={(e) =>
                update({ user: e.target.value, with: null }, 'push')
              }
            >
              {!viewer && <option value={user.uid}>You</option>}
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id === user.uid ? 'You' : p.name}
                </option>
              ))}
            </select>
          </label>
          <Toggle
            label="Period"
            value={view.period}
            options={[
              ['year', String(year)],
              ['all', 'All time'],
            ]}
            onChange={(period) => update({ period })}
          />
        </div>
      </div>

      <div role="tablist" className="tabs tabs-border">
        {(
          [
            ['me', isMe || !viewer ? 'Me' : viewer.name],
            ['together', 'Together'],
          ] as const
        ).map(([tab, text]) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={view.tab === tab}
            onClick={() => update({ tab }, 'push')}
            className={`tab font-semibold ${view.tab === tab ? 'tab-active' : ''}`}
          >
            {text}
          </button>
        ))}
      </div>

      {!viewer ? (
        <Empty>Log your first location on the map to see your stats.</Empty>
      ) : view.tab === 'me' ? (
        <MeStats
          stats={personStats(viewer.entries, viewer.stays, from, now)}
          name={isMe ? null : viewer.name}
          periodWord={view.period === 'year' ? 'this year' : 'overall'}
          now={now}
          rankBy={view.rank}
          modeBy={view.modes}
          onRankByChange={(rank) => update({ rank })}
          onModeByChange={(modes) => update({ modes })}
          recordHref={recordHref}
        />
      ) : (
        <TogetherStats
          people={people}
          viewerId={viewer.id}
          meId={user.uid}
          from={from}
          now={now}
          periodText={view.period === 'year' ? `in ${year}` : 'so far'}
          withId={view.with}
          onWithChange={(id) => update({ with: id })}
        />
      )}

      <details className="text-sm">
        <summary className="cursor-pointer font-semibold">
          How these are counted
        </summary>
        <ul className="mt-2 flex max-w-prose list-disc flex-col gap-1 pl-5 opacity-80">
          <li>
            A stay lasts from an entry until that person&apos;s next entry. The
            latest one runs until now. Planned future entries don&apos;t count
            until their time comes.
          </li>
          <li>
            Together means two people had stays in the same city at the same
            time, even if they didn&apos;t meet.
          </li>
          <li>
            Home is the city where someone spent the most time in the period
            you&apos;re looking at, so a move shows up from the year it
            happened.
          </li>
          <li>
            Days are calendar days: any time in a city that day counts, so the
            day you travel counts for both cities, and days together count
            whenever you were both in the same city.
          </li>
          <li>
            Distances are the shortest way between two cities over the
            Earth&apos;s surface, as the crow flies, added up trip by trip.
          </li>
        </ul>
      </details>
    </Container>
  )
}

// Reading the URL needs a Suspense boundary for the production build.
const StatsPage = () => (
  <Suspense fallback={<Spinner />}>
    <StatsView />
  </Suspense>
)

export default StatsPage
