import {
  distanceKm,
  formatDay,
  formatDays,
  formatKm,
  formatRange,
  type PersonStats,
  type Place,
  plural,
} from '@/lib/stats'
import type { RecordId } from '@/lib/statsParams'
import { travelIcon } from '@/lib/travel'

export type RecordText = { label: string; value: string; detail: string }

/** What a record card says, or null when there's nothing to show. */
export const describeRecord = (
  id: RecordId,
  st: PersonStats,
  periodWord: string,
  name: string | null
): RecordText | null => {
  switch (id) {
    case 'longest-trip': {
      const l = st.longestLeg
      if (!l) return null
      return {
        label: 'Longest trip',
        value: formatKm(l.km),
        detail: `${l.from.city} → ${l.to.city} ${travelIcon(l.mode)} · ${formatDay(l.time)}`,
      }
    }
    case 'farthest': {
      const f = st.farthest
      if (!f || !st.home || f.km <= 0) return null
      return {
        label: 'Farthest from home',
        value: f.place.city,
        detail: `${formatKm(f.km)} from ${st.home.city}`,
      }
    }
    case 'longest-away': {
      const a = st.longestAway
      if (!a) return null
      return {
        label: 'Longest time away',
        value: formatDays(a.days),
        detail: `${a.places.map((p) => p.city).join(', ')} · ${formatRange(a.start, a.end)}`,
      }
    }
    case 'busiest-week': {
      const w = st.busiestWeek
      if (!w) return null
      return {
        label: 'Busiest week',
        value: plural(w.places.length, 'city'),
        detail: `${w.places.map((p) => p.city).join(', ')} · from ${formatDay(w.start)}`,
      }
    }
    case 'new-cities': {
      const n = st.newPlaces
      return {
        label: 'New cities',
        value: String(n.length),
        detail: n.length
          ? `Latest: ${n[0].place.city} · ${formatDay(n[0].time)}`
          : `None ${periodWord}`,
      }
    }
    case 'edges': {
      const e = st.edges
      if (!e) return null
      return {
        label: name ? `Edges of ${name}'s map` : 'Edges of your map',
        value: formatKm(distanceKm(e.N, e.S)),
        detail: `north to south · N ${e.N.city} · S ${e.S.city} · E ${e.E.city} · W ${e.W.city}`,
      }
    }
  }
}

export type Stop = {
  place: Place
  label: string
  kind: 'home' | 'main' | 'stop'
}

/** What to draw on the map for a record. */
export type RecordShape = {
  stops: Stop[]
  // A line through these places, in order.
  path?: Place[]
  pathLabel?: string
  // A circle around home reaching the farthest place.
  circle?: { center: Place; radiusKm: number }
  // The box spanned by the northern-, southern-, eastern- and westernmost places.
  box?: { south: number; west: number; north: number; east: number }
}

const shortDay = (t: number) =>
  new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

// Numbered stops along a route. A city visited twice gets one label with
// both numbers, so labels don't sit on top of each other on the map.
const numberedStops = (visits: { place: Place; when: string }[]): Stop[] => {
  const byPlace = new Map<
    string,
    { place: Place; nums: number[]; whens: string[] }
  >()
  visits.forEach(({ place, when }, i) => {
    const item = byPlace.get(place.key)
    if (item) {
      item.nums.push(i + 1)
      item.whens.push(when)
    } else byPlace.set(place.key, { place, nums: [i + 1], whens: [when] })
  })
  return [...byPlace.values()].map(({ place, nums, whens }) => ({
    place,
    label: `${nums.join(', ')} · ${place.city} · ${whens.join(', ')}`,
    kind: 'main',
  }))
}

const homeStop = (home: Place): Stop => ({
  place: home,
  label: `Home · ${home.city}`,
  kind: 'home',
})

export const recordShape = (
  id: RecordId,
  st: PersonStats,
  now: number
): RecordShape | null => {
  switch (id) {
    case 'longest-trip': {
      const l = st.longestLeg
      if (!l) return null
      return {
        stops: [
          { place: l.from, label: `From ${l.from.city}`, kind: 'stop' },
          {
            place: l.to,
            label: `${l.to.city} · ${shortDay(l.time)}`,
            kind: 'main',
          },
        ],
        path: [l.from, l.to],
        pathLabel: `${formatKm(l.km)} ${travelIcon(l.mode)}`,
      }
    }
    case 'farthest': {
      const f = st.farthest
      if (!f || !st.home) return null
      return {
        stops: [
          homeStop(st.home),
          { place: f.place, label: f.place.city, kind: 'main' },
        ],
        path: [st.home, f.place],
        pathLabel: formatKm(f.km),
        circle: { center: st.home, radiusKm: f.km },
      }
    }
    case 'longest-away': {
      const a = st.longestAway
      if (!a) return null
      const back = a.end < now - 60_000
      const stops = numberedStops(
        a.stays.map((s) => ({
          place: s.place,
          when: formatRange(s.start, s.end),
        }))
      )
      const path = a.stays.map((s) => s.place)
      if (st.home) {
        stops.unshift(homeStop(st.home))
        path.unshift(st.home)
        if (back) path.push(st.home)
      }
      return { stops, path }
    }
    case 'busiest-week': {
      const w = st.busiestWeek
      if (!w) return null
      return {
        stops: numberedStops(
          w.stays.map((s) => ({ place: s.place, when: shortDay(s.start) }))
        ),
        path: w.stays.map((s) => s.place),
      }
    }
    case 'new-cities': {
      if (!st.newPlaces.length) return null
      return {
        stops: st.newPlaces.map((e, i) => ({
          place: e.place,
          label: `${e.place.city} · ${shortDay(e.time)}`,
          kind: i === 0 ? 'main' : 'stop',
        })),
      }
    }
    case 'edges': {
      const e = st.edges
      if (!e) return null
      // One label per city, even if it's the edge in two directions.
      const byPlace = new Map<string, { place: Place; dirs: string[] }>()
      for (const dir of ['N', 'S', 'E', 'W'] as const) {
        const item = byPlace.get(e[dir].key)
        if (item) item.dirs.push(dir)
        else byPlace.set(e[dir].key, { place: e[dir], dirs: [dir] })
      }
      return {
        stops: [...byPlace.values()].map(({ place, dirs }) => ({
          place,
          label: `${dirs.join(', ')} · ${place.city}`,
          kind: 'main',
        })),
        box: { south: e.S.lat, west: e.W.lng, north: e.N.lat, east: e.E.lng },
      }
    }
  }
}
