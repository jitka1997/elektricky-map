'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import type { Period } from '@/lib/stats'

/** The records that can be shown on the map. */
export const RECORDS = [
  'longest-trip',
  'farthest',
  'longest-away',
  'busiest-week',
  'new-cities',
  'edges',
] as const
export type RecordId = (typeof RECORDS)[number]

// What the stats page is showing lives in the URL, so a link, a refresh or the
// back button brings you to the same view. Defaults are left out of the URL.
const DEFAULTS = {
  user: null, // whose stats; none = your own
  period: 'year',
  tab: 'me',
  with: null, // the friend picked in Together
  rank: 'time',
  modes: 'trips',
  record: null, // on the map: the record being shown
} as const
type Key = keyof typeof DEFAULTS

export type StatsView = {
  user: string | null
  period: Period
  tab: 'me' | 'together'
  with: string | null
  rank: 'time' | 'visits'
  modes: 'trips' | 'km'
  record: RecordId | null
}

const oneOf = <T extends string>(
  value: string | null,
  options: T[],
  fallback: T
) => (options.includes(value as T) ? (value as T) : fallback)

export const readStatsView = (
  params: Pick<URLSearchParams, 'get'>
): StatsView => ({
  user: params.get('user'),
  period: oneOf(params.get('period'), ['year', 'all'], 'year'),
  tab: oneOf(params.get('tab'), ['me', 'together'], 'me'),
  with: params.get('with'),
  rank: oneOf(params.get('rank'), ['time', 'visits'], 'time'),
  modes: oneOf(params.get('modes'), ['trips', 'km'], 'trips'),
  record: oneOf<RecordId | ''>(params.get('record'), [...RECORDS], '') || null,
})

/** A query string for `params` with `changes` applied (defaults dropped). */
export const statsQuery = (
  params: URLSearchParams,
  changes: Partial<Record<Key, string | null>>
) => {
  const next = new URLSearchParams(params)
  for (const [key, value] of Object.entries(changes) as [Key, string | null][])
    if (value === null || value === DEFAULTS[key]) next.delete(key)
    else next.set(key, value)
  const query = next.toString()
  return query ? `?${query}` : ''
}

/**
 * The stats view from the URL, plus `update` to change it. `push` adds a
 * browser history step (Back returns to the previous view); `replace` changes
 * the URL in place, for small switches you wouldn't want to step back through.
 */
export const useStatsView = () => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const params = new URLSearchParams(searchParams.toString())

  const update = (
    changes: Partial<Record<Key, string | null>>,
    how: 'push' | 'replace' = 'replace'
  ) => router[how](pathname + statsQuery(params, changes), { scroll: false })

  return { view: readStatsView(params), params, update }
}
