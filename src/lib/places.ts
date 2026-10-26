// Place identity: which logged entries are the same place.
//
// New entries save the map ID of their place ("osm:R3687140") and its
// country code. Places are compared by that ID, so a place the search service
// renames or spells differently ("Da Nang" / "Đà Nẵng") still counts as the
// same one. Entries from before IDs fall back to comparing name and country.
//
// Used by the app and by the server (arrival notifications), so keep it free
// of anything browser-only.
import { toDate } from '@/lib/dates'
import type { LocationEntry } from '@/lib/firebase'
import { type CityOption, kmBetween, normalizeName } from '@/lib/utils'

/** Our ID for a place on the map: the search service's OpenStreetMap ID with
 * a prefix, so IDs from another source could sit beside it one day. */
export const placeIdFromOsm = (osmId?: string) =>
  osmId ? `osm:${osmId}` : undefined

type Named = { city: string; country: string; placeId?: string | null }

const nameKey = (p: Named) =>
  `${normalizeName(p.city)}|${normalizeName(p.country)}`

/** Whether two entries (or a pick and an entry) are the same place: by ID
 * when both have one, otherwise by name and country. */
export const samePlace = (a?: Named | null, b?: Named | null) =>
  !!a &&
  !!b &&
  (a.placeId && b.placeId ? a.placeId === b.placeId : nameKey(a) === nameKey(b))

/**
 * A key per entry for counting places together (Stats): the place ID, or for
 * an older entry without one, the ID that newer entries with the same name
 * use, so an old "Beaconsfield" and a new one count as one place. A name
 * used by two different places (two villages called Nová Ves) stays apart.
 */
export const placeKeyFor = (entries: Named[]) => {
  const idsByName = new Map<string, Set<string>>()
  for (const e of entries) {
    if (!e.placeId) continue
    const ids = idsByName.get(nameKey(e)) ?? new Set<string>()
    ids.add(e.placeId)
    idsByName.set(nameKey(e), ids)
  }
  return (e: Named) => {
    if (e.placeId) return e.placeId
    const ids = idsByName.get(nameKey(e))
    return ids?.size === 1 ? [...ids][0] : `name:${nameKey(e)}`
  }
}

/** Within this distance, a place with the same name and country is the same
 * place (the map sometimes has a town twice: as a point and as an area). */
const SAME_PLACE_KM = 10

/**
 * The version of a picked place that gets saved. If anyone in the group has
 * logged it before (same ID, or same name and country within SAME_PLACE_KM),
 * it keeps the name and position from the first time it was logged: a later
 * rename by the search service changes nothing, and pins line up exactly.
 * A place nobody has logged keeps the search service's name and position.
 */
export const resolvePlace = (
  picked: CityOption,
  logged: LocationEntry[]
): CityOption => {
  const placeId = picked.placeId ?? placeIdFromOsm(picked.osmId)
  const oldestFirst = [...logged].sort(
    (a, b) => toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime()
  )
  const known =
    (placeId && oldestFirst.find((l) => l.placeId === placeId)) ||
    oldestFirst.find(
      (l) =>
        nameKey(l) === nameKey(picked) &&
        kmBetween(l.latitude, l.longitude, picked.latitude, picked.longitude) <
          SAME_PLACE_KM
    )
  if (!known) return { ...picked, placeId }
  return {
    ...picked,
    city: known.city,
    country: known.country,
    latitude: known.latitude,
    longitude: known.longitude,
    // An older entry without an ID gets this pick's ID from now on.
    placeId: known.placeId ?? placeId,
    countryCode: picked.countryCode ?? known.countryCode,
  }
}

/** The place fields to save with an entry (left out when unknown, since
 * Firestore can't store "undefined"). */
export const placeFields = (city: CityOption) => ({
  ...(city.placeId && { placeId: city.placeId }),
  ...(city.countryCode && { countryCode: city.countryCode }),
})
