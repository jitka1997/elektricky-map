'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import Container from '@/components/Container'
import MeStats, { Empty } from '@/components/stats/MeStats'
import TogetherStats from '@/components/stats/TogetherStats'
import Toggle from '@/components/stats/Toggle'
import { useAuth } from '@/lib/AuthContext'
import { useLocations } from '@/lib/LocationContext'
import { shortName } from '@/lib/names'
import {
  personStats,
  type Place,
  type StatsPerson,
  toEntries,
  toStays,
} from '@/lib/stats'

type Period = 'year' | 'all'
type Tab = 'me' | 'together'

const StatsPage = () => {
  const { user, loading } = useAuth()
  const { locationData, isLoading, setFlyTarget } = useLocations()
  const router = useRouter()

  // Fixed for the visit, so every number is measured to the same moment.
  const [now] = useState(() => Date.now())
  const [viewerId, setViewerId] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('year')
  const [tab, setTab] = useState<Tab>('me')

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [loading, user, router])

  const people = useMemo<StatsPerson[]>(
    () =>
      locationData
        .map((u) => {
          const entries = toEntries(u.locations ?? [], now)
          return {
            id: u.userId,
            name: shortName(u.userName, u.customName) || 'Anonymous',
            photoURL: u.photoURL,
            entries,
            stays: toStays(entries, now),
          }
        })
        .filter((p) => p.entries.length > 0),
    [locationData, now]
  )

  if (loading || isLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

  const year = new Date(now).getFullYear()
  const from = period === 'year' ? new Date(year, 0, 1).getTime() : 0
  const viewer =
    people.find((p) => p.id === (viewerId ?? user.uid)) ??
    people.find((p) => p.id === user.uid)
  const isMe = viewer?.id === user.uid

  const showOnMap = (place: Place) => {
    setFlyTarget({ lat: place.lat, lng: place.lng })
    router.push('/')
  }

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
              onChange={(e) => setViewerId(e.target.value)}
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
            value={period}
            options={[
              ['year', String(year)],
              ['all', 'All time'],
            ]}
            onChange={setPeriod}
          />
        </div>
      </div>

      <div role="tablist" className="tabs tabs-border">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'me'}
          onClick={() => setTab('me')}
          className={`tab font-semibold ${tab === 'me' ? 'tab-active' : ''}`}
        >
          {isMe || !viewer ? 'Me' : viewer.name}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'together'}
          onClick={() => setTab('together')}
          className={`tab font-semibold ${tab === 'together' ? 'tab-active' : ''}`}
        >
          Together
        </button>
      </div>

      {!viewer ? (
        <Empty>Log your first location on the map to see your stats.</Empty>
      ) : tab === 'me' ? (
        <MeStats
          key={viewer.id}
          stats={personStats(viewer.entries, viewer.stays, from, now)}
          name={isMe ? null : viewer.name}
          periodWord={period === 'year' ? 'this year' : 'overall'}
          now={now}
          onShowOnMap={showOnMap}
        />
      ) : (
        <TogetherStats
          key={viewer.id}
          people={people}
          viewerId={viewer.id}
          meId={user.uid}
          from={from}
          now={now}
          periodText={period === 'year' ? `in ${year}` : 'so far'}
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
            Home is the city where someone has spent the most time overall.
          </li>
          <li>
            Distances are straight lines between cities, like the journey lines
            on the map.
          </li>
        </ul>
      </details>
    </Container>
  )
}

export default StatsPage
