import { toDate } from '@/lib/dates'
import type { LocationEntry } from '@/lib/firebase'
import type { CityOption } from '@/lib/utils'

/** Whether a picked city is the same place as a logged location. */
export const sameCity = (city: CityOption | null, loc?: LocationEntry) =>
  !!(
    city &&
    loc &&
    city.city.trim().toLowerCase() === loc.city.trim().toLowerCase() &&
    city.country.trim().toLowerCase() === loc.country.trim().toLowerCase()
  )

/**
 * The entries immediately newer and older than time `t` (ms) in a newest-first
 * list — i.e. the neighbours an entry at that time would sit between.
 * `excludeId` skips the entry being edited.
 */
export const neighborsAt = (
  locations: LocationEntry[],
  t: number,
  excludeId?: string
) => {
  let newer: LocationEntry | undefined
  let older: LocationEntry | undefined
  for (const loc of locations) {
    if (excludeId && loc.id === excludeId) continue
    if (toDate(loc.createdAt).getTime() > t) newer = loc
    else {
      older = loc
      break
    }
  }
  return { newer, older }
}

/** True if the location is logged for a time later than `now`. */
export const isFuture = (loc: LocationEntry, now: number) =>
  toDate(loc.createdAt).getTime() > now

/** Locations up to `now` (future/planned entries removed), order preserved. */
export const pastLocations = (locations: LocationEntry[], now: number) =>
  locations.filter((loc) => !isFuture(loc, now))
