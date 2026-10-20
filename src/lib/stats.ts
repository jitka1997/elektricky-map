import { toDate } from '@/lib/dates'
import type { LocationEntry } from '@/lib/firebase'
import { shortName } from '@/lib/names'
import { DEFAULT_TRAVEL_MODE, TravelMode } from '@/lib/travel'
import type { LocationData } from '@/lib/types'

export const DAY = 86_400_000
const EARTH_KM = 40_075

/** A city, identified by name + country (coordinates can differ slightly). */
export type Place = {
  key: string
  city: string
  country: string
  lat: number
  lng: number
}

/** A logged location, as a point in time. */
export type Entry = { place: Place; time: number; mode: TravelMode }

/** Time spent in one place: from an entry until the next one (or now). */
export type Stay = { place: Place; start: number; end: number }

/** Moving between two different places. */
export type Leg = {
  from: Place
  to: Place
  time: number
  mode: TravelMode
  km: number
}

/** Time spent in the same city as someone else. */
export type Overlap = { place: Place; start: number; end: number }

const placeOf = (l: LocationEntry): Place => ({
  key: `${l.city.trim().toLowerCase()}|${l.country.trim().toLowerCase()}`,
  city: l.city.trim(),
  country: l.country.trim(),
  lat: l.latitude,
  lng: l.longitude,
})

/** Straight-line distance in km (like the journey lines on the map). */
export const distanceKm = (a: Place, b: Place) => {
  const r = Math.PI / 180
  const h =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) *
      Math.cos(b.lat * r) *
      Math.sin(((b.lng - a.lng) * r) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** A user's entries up to `now` (planned ones left out), oldest first. */
export const toEntries = (locations: LocationEntry[], now: number): Entry[] =>
  locations
    .map((l) => ({
      place: placeOf(l),
      time: toDate(l.createdAt).getTime(),
      mode: l.travelMode ?? DEFAULT_TRAVEL_MODE,
    }))
    .filter((e) => e.time <= now)
    .sort((a, b) => a.time - b.time)

/**
 * Each entry lasts until the next one; the latest until `now`. Back-to-back
 * entries in the same city count as one stay.
 */
export const toStays = (entries: Entry[], now: number): Stay[] => {
  const stays: Stay[] = []
  entries.forEach((e, i) => {
    const end = entries[i + 1]?.time ?? now
    const last = stays[stays.length - 1]
    if (last && last.place.key === e.place.key) last.end = end
    else stays.push({ place: e.place, start: e.time, end })
  })
  return stays
}

const clip = (stays: Stay[], from: number, to: number): Stay[] =>
  stays
    .map((s) => ({
      ...s,
      start: Math.max(s.start, from),
      end: Math.min(s.end, to),
    }))
    .filter((s) => s.end > s.start)

/** Adds `amount` to the total for a place in a map keyed by place. */
const addTo = <T extends { place: Place; value: number }>(
  map: Map<string, T>,
  place: Place,
  amount: number
) => {
  const item = map.get(place.key)
  if (item) item.value += amount
  else map.set(place.key, { place, value: amount } as T)
}

export type PlaceTotal = { place: Place; value: number }

const startOfDay = (t: number) => {
  const d = new Date(t)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/**
 * How many calendar days (in this device's time zone) these periods touch.
 * A day counts if any part of it is covered, so the day you travel counts
 * for both cities, and a few hours somewhere count as a day there.
 */
export const calendarDays = (periods: { start: number; end: number }[]) => {
  const days = new Set<number>()
  for (const { start, end } of periods) {
    if (end <= start) continue
    const last = startOfDay(end - 1)
    for (
      const d = new Date(startOfDay(start));
      d.getTime() <= last;
      d.setDate(d.getDate() + 1)
    )
      days.add(d.getTime())
  }
  return days.size
}

/** Days per place (each place's own days; a travel day counts for both). */
const daysByPlace = (
  periods: { place: Place; start: number; end: number }[]
) => {
  const byPlace = new Map<string, { place: Place; periods: typeof periods }>()
  for (const p of periods) {
    const item = byPlace.get(p.place.key)
    if (item) item.periods.push(p)
    else byPlace.set(p.place.key, { place: p.place, periods: [p] })
  }
  return [...byPlace.values()]
    .map(({ place, periods }) => ({ place, value: calendarDays(periods) }))
    .sort((a, b) => b.value - a.value)
}

const sortedTotals = (map: Map<string, PlaceTotal>) =>
  [...map.values()].sort((a, b) => b.value - a.value)

/**
 * Home: the place where the most time was spent within [from, to]. Measured
 * per period rather than overall, so someone who moved gets their new city
 * as home for the year they've mostly lived there.
 */
export const homeOf = (
  stays: Stay[],
  from = -Infinity,
  to = Infinity
): Place | undefined => {
  const time = new Map<string, PlaceTotal>()
  for (const s of clip(stays, from, to)) addTo(time, s.place, s.end - s.start)
  return sortedTotals(time)[0]?.place
}

export type PersonStats = ReturnType<typeof personStats>

/** Everything the "Me" view shows, for one person within [from, to]. */
export const personStats = (
  entries: Entry[],
  stays: Stay[],
  from: number,
  to: number
) => {
  const home = homeOf(stays, from, to)
  const inPeriod = clip(stays, from, to)

  // Days in each place.
  const time = daysByPlace(inPeriod)

  // Arriving somewhere new; a repeated entry in the same city isn't a visit.
  const visits = new Map<string, PlaceTotal>()
  const legs: Leg[] = []
  entries.forEach((e, i) => {
    if (e.time < from || e.time > to) return
    const prev = entries[i - 1]
    if (prev && prev.place.key === e.place.key) return
    addTo(visits, e.place, 1)
    if (prev) {
      legs.push({
        from: prev.place,
        to: e.place,
        time: e.time,
        mode: e.mode,
        km: distanceKm(prev.place, e.place),
      })
    }
  })

  const places = time.map((t) => t.place)
  const countries = new Set(places.map((p) => p.country.toLowerCase()))
  const km = legs.reduce((n, l) => n + l.km, 0)
  // Days with any time away from home.
  const away = calendarDays(inPeriod.filter((s) => s.place.key !== home?.key))
  // Days in the period, from the first entry if the person started within it.
  const tracked = calendarDays([
    { start: Math.max(from, entries[0]?.time ?? from), end: to },
  ])
  const entryCount = entries.filter(
    (e) => e.time >= from && e.time <= to
  ).length

  // Records
  const longestLeg = legs.reduce<Leg | null>(
    (m, l) => (!m || l.km > m.km ? l : m),
    null
  )
  const farthest = home
    ? places
        .map((place) => ({ place, km: distanceKm(home, place) }))
        .sort((a, b) => b.km - a.km)[0]
    : undefined

  // The stays of a trip away from home, in order (`places` without repeats).
  type AwayRun = {
    start: number
    end: number
    days: number
    places: Place[]
    stays: Stay[]
  }
  let run: AwayRun | null = null
  let longestAway = null as AwayRun | null
  for (const s of inPeriod) {
    if (s.place.key === home?.key) {
      run = null
      continue
    }
    if (!run)
      run = { start: s.start, end: s.end, days: 0, places: [], stays: [] }
    run.end = s.end
    run.days = calendarDays([run])
    run.stays.push(s)
    if (!run.places.some((p) => p.key === s.place.key)) run.places.push(s.place)
    if (
      !longestAway ||
      run.days > longestAway.days ||
      (run.days === longestAway.days &&
        run.end - run.start > longestAway.end - longestAway.start)
    )
      longestAway = { ...run, places: [...run.places], stays: [...run.stays] }
  }

  // The most different cities within 7 days of arriving somewhere.
  let busiestWeek: { start: number; places: Place[]; stays: Stay[] } | null =
    null
  for (const l of legs) {
    const weekStays = clip(stays, l.time, Math.min(l.time + 7 * DAY, to))
    const weekPlaces: Place[] = []
    for (const s of weekStays)
      if (!weekPlaces.some((p) => p.key === s.place.key))
        weekPlaces.push(s.place)
    if (!busiestWeek || weekPlaces.length > busiestWeek.places.length)
      busiestWeek = { start: l.time, places: weekPlaces, stays: weekStays }
  }

  // First time ever in a city (not counting where they started logging).
  const firstSeen = new Map<string, Entry>()
  for (const e of entries.slice(1))
    if (!firstSeen.has(e.place.key) && e.place.key !== entries[0].place.key)
      firstSeen.set(e.place.key, e)
  const newPlaces = [...firstSeen.values()]
    .filter((e) => e.time >= from && e.time <= to)
    .sort((a, b) => b.time - a.time)

  const byLat = [...places].sort((a, b) => b.lat - a.lat)
  const byLng = [...places].sort((a, b) => b.lng - a.lng)

  return {
    home,
    time,
    visits: sortedTotals(visits),
    legs,
    placeCount: places.length,
    countryCount: countries.size,
    km,
    aroundEarth: km / EARTH_KM,
    away,
    tracked,
    entryCount,
    lastEntry: entries[entries.length - 1] as Entry | undefined,
    longestLeg,
    farthest,
    longestAway,
    busiestWeek,
    newPlaces,
    edges: places.length
      ? {
          N: byLat[0],
          S: byLat[byLat.length - 1],
          E: byLng[0],
          W: byLng[byLng.length - 1],
        }
      : null,
  }
}

export type Together = ReturnType<typeof together>

/** When and where two people were in the same city within [from, to]. */
export const together = (a: Stay[], b: Stay[], from: number, to: number) => {
  const overlaps: Overlap[] = []
  for (const x of clip(a, from, to)) {
    for (const y of b) {
      if (x.place.key !== y.place.key) continue
      const start = Math.max(x.start, y.start)
      const end = Math.min(x.end, y.end)
      if (end > start) overlaps.push({ place: x.place, start, end })
    }
  }
  overlaps.sort((p, q) => p.start - q.start)

  // Join pieces that continue each other in the same city.
  const merged: Overlap[] = []
  for (const o of overlaps) {
    const last = merged[merged.length - 1]
    if (last && last.place.key === o.place.key && o.start - last.end < 60_000)
      last.end = Math.max(last.end, o.end)
    else merged.push({ ...o })
  }

  // The longest stretch: most days, then most hours.
  const longest = merged.reduce<Overlap | null>((m, o) => {
    if (!m) return o
    const diff = calendarDays([o]) - calendarDays([m])
    return diff > 0 || (diff === 0 && o.end - o.start > m.end - m.start) ? o : m
  }, null)

  return {
    overlaps: merged,
    // Days you were in the same city at some point.
    total: calendarDays(merged),
    byPlace: daysByPlace(merged),
    last: merged[merged.length - 1] as Overlap | undefined,
    longest,
    longestDays: longest ? calendarDays([longest]) : 0,
  }
}

// ---- Formatting ----

const dateOpts: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
}

export const formatDay = (t: number) =>
  new Date(t).toLocaleDateString('en-GB', dateOpts)

/** e.g. "16–26 Jul 2026", "30 Apr – 6 May 2026". */
export const formatRange = (start: number, end: number) => {
  const a = new Date(start)
  const b = new Date(end)
  if (a.getFullYear() !== b.getFullYear())
    return `${formatDay(start)} – ${formatDay(end)}`
  if (a.getMonth() !== b.getMonth())
    return `${a.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${formatDay(end)}`
  if (a.getDate() === b.getDate()) return formatDay(end)
  return `${a.getDate()}–${formatDay(end)}`
}

/** A number of calendar days, e.g. "1 day", "12 days". */
export const formatDays = (days: number) => plural(days, 'day')

export const formatKm = (km: number) =>
  `${Math.round(km).toLocaleString('en-GB')} km`

export const daysAgo = (t: number, now: number) => {
  const d = Math.floor((now - t) / DAY)
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`
}

export const plural = (n: number, word: string) => {
  const many = /[^aeiou]y$/.test(word) ? `${word.slice(0, -1)}ies` : `${word}s`
  return `${n.toLocaleString('en-GB')} ${n === 1 ? word : many}`
}

// Mid-tone colors that read on both the light and the dark theme.
const PALETTE = [
  'oklch(64% 0.12 250)',
  'oklch(64% 0.11 165)',
  'oklch(64% 0.13 305)',
  'oklch(72% 0.13 85)',
  'oklch(64% 0.14 15)',
  'oklch(66% 0.1 210)',
  'oklch(66% 0.13 135)',
  'oklch(62% 0.14 340)',
  'oklch(68% 0.14 50)',
]

/** A stable color per city, so it looks the same everywhere. */
export const placeColor = (place: Place) => {
  let h = 0
  for (const ch of place.key) h = (h * 31 + ch.charCodeAt(0)) | 0
  return PALETTE[Math.abs(h) % PALETTE.length]
}

export const MODE_COLORS: Record<TravelMode, string> = {
  train: PALETTE[0],
  bus: PALETTE[1],
  plane: PALETTE[2],
  ship: PALETTE[5],
  car: PALETTE[8],
  walk: PALETTE[6],
  other: PALETTE[3],
}

/** One person's data, ready for the stats views. */
export type StatsPerson = {
  id: string
  name: string
  photoURL: string | null
  entries: Entry[]
  stays: Stay[]
}

/** Everyone who has logged something, ready for the stats views. */
export const toPeople = (
  locationData: LocationData[],
  now: number
): StatsPerson[] =>
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
    .filter((p) => p.entries.length > 0)

export type Period = 'year' | 'all'

/** When a period starts: 1 January of the current year, or the beginning. */
export const periodStart = (period: Period, now: number) =>
  period === 'year' ? new Date(new Date(now).getFullYear(), 0, 1).getTime() : 0
