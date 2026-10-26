/**
 * Geocoding helpers backed by Photon (https://photon.komoot.io), an
 * OpenStreetMap-based geocoder built for search-as-you-type. Unlike Nominatim
 * it has no 1-request/second autocomplete restriction, so it's safe to call on
 * every keystroke (debounced).
 */

const PHOTON_BASE = 'https://photon.komoot.io'

// Only populated places, never streets, buildings or postcodes. Countries
// too, but only ones small enough to be a place of their own (see below).
const SETTLEMENT_TAGS = [
  'place:city',
  'place:town',
  'place:village',
  'place:hamlet',
]
const COUNTRY_TAGS = ['place:country']
const PLACE_TAGS = [...SETTLEMENT_TAGS, ...COUNTRY_TAGS]

// A country no more than this across is one place, like a city: Vatican City
// (1 km), Gibraltar, San Marino (11), Liechtenstein (25), Monaco (26),
// Andorra (31). The next sizes up are island nations and Luxembourg
// (50–80+ km, mostly sea), which have their own towns to log instead.
const SMALL_COUNTRY_KM = 40

// Photon is a free public service; it can be slow (10+ s when busy) or stop
// answering. Wait a good while, but not forever.
const TIMEOUT_MS = 25_000

// 'country': a country small enough to be one place (see SMALL_COUNTRY_KM).
export type PlaceKind = 'city' | 'town' | 'village' | 'hamlet' | 'country'

export type CityOption = {
  city: string
  country: string
  state?: string
  latitude: number
  longitude: number
  // Which map object this is (not saved with entries yet).
  kind?: PlaceKind
  countryCode?: string
  osmId?: string // e.g. "R3687140" (R = area/relation, N = point, W = way)
  // The ID it's saved under (see places.ts), once matched to the group's
  // places; e.g. "osm:R3687140".
  placeId?: string
  // For small countries: how far they reach from their centre.
  reachKm?: number
}

/** A place near the user, with how far its centre is from them. */
export type NearbyCity = CityOption & { distanceKm: number }

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] }
  properties?: {
    name?: string
    state?: string
    county?: string
    country?: string
    countrycode?: string
    osm_type?: string
    osm_id?: number
    osm_key?: string
    osm_value?: string
    // Bounding box: [west, north, east, south].
    extent?: [number, number, number, number]
  }
}

/** "Bratislava, Slovakia"; a small country is just "San Marino". */
export const formatCity = (city: CityOption): string =>
  [city.city, city.state, city.country !== city.city ? city.country : null]
    .filter(Boolean)
    .join(', ')

const KINDS: PlaceKind[] = ['city', 'town', 'village', 'hamlet']

/** A Photon place as a CityOption, or null for anything that isn't a place
 * someone can be in (a whole country, an unnamed object…). */
const featureToCityOption = (feature: PhotonFeature): CityOption | null => {
  const props = feature.properties
  const coords = feature.geometry?.coordinates
  if (!props?.name || !coords) return null

  const countryCode = props.countrycode?.toUpperCase()
  let kind: PlaceKind
  let reachKm: number | undefined
  if (props.osm_value === 'country') {
    // Only countries small enough to be one place; we need their size.
    if (!props.extent) return null
    const [west, north, east, south] = props.extent
    const sizeKm = Math.max(
      kmBetween((north + south) / 2, west, (north + south) / 2, east),
      kmBetween(south, west, north, west)
    )
    if (sizeKm > SMALL_COUNTRY_KM) return null
    kind = 'country'
    reachKm = Math.max(1, sizeKm / 2)
  } else {
    kind = KINDS.includes(props.osm_value as PlaceKind)
      ? (props.osm_value as PlaceKind)
      : 'village'
  }

  return {
    city: props.name,
    country: props.country || 'Unknown',
    state: kind === 'country' ? undefined : props.state || props.county,
    // GeoJSON coordinates are [longitude, latitude].
    latitude: coords[1],
    longitude: coords[0],
    kind,
    countryCode,
    osmId:
      props.osm_type && props.osm_id
        ? `${props.osm_type}${props.osm_id}`
        : undefined,
    reachKm,
  }
}

/** Straight-line distance in km. */
export const kmBetween = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) => {
  const r = Math.PI / 180
  const h =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) *
      Math.cos(lat2 * r) *
      Math.sin(((lon2 - lon1) * r) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** Lowercase without accents, for comparing names ("Košice" = "kosice"). */
export const normalizeName = (name: string) =>
  name
    .normalize('NFD')
    // The accent marks that NFD splits off ("š" → "s" + "ˇ").
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

/**
 * The same town is sometimes mapped twice (as a point and as an area), so it
 * would show up twice. Keeps the first of each, preferring the area version.
 */
const dropDuplicates = <T extends CityOption>(options: T[]) => {
  const kept: T[] = []
  for (const option of options) {
    const i = kept.findIndex(
      (k) =>
        normalizeName(k.city) === normalizeName(option.city) &&
        k.countryCode === option.countryCode &&
        kmBetween(k.latitude, k.longitude, option.latitude, option.longitude) <
          10
    )
    if (i === -1) kept.push(option)
    else if (option.osmId?.startsWith('R') && !kept[i].osmId?.startsWith('R'))
      kept[i] = option
  }
  return kept
}

/** Raw Photon results, limited to the given kinds of map objects (none =
 * anything: buildings, roads…). */
const fetchFeatures = async (
  path: string,
  params: URLSearchParams,
  tags: string[]
): Promise<PhotonFeature[]> => {
  params.set('lang', 'en')
  for (const tag of tags) params.append('osm_tag', tag)
  const url = `${PHOTON_BASE}/${path}?${params}`
  const signal = AbortSignal.timeout(TIMEOUT_MS)
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  // Photon is free and sometimes drops out for a few seconds: "busy"
  // answers (502–504) and refused connections usually clear up quickly, so
  // try up to 3 times (after 1 s, then 2 s). Running out of time is final.
  for (let attempt = 1; ; attempt++) {
    let response: Response
    try {
      response = await fetch(url, { signal })
    } catch (error) {
      // No connection at all is a TypeError ("Failed to fetch").
      if (error instanceof TypeError && attempt < 3) {
        await wait(attempt * 1000)
        continue
      }
      throw error
    }
    if (response.status >= 502 && response.status <= 504 && attempt < 3) {
      await wait(attempt * 1000)
      continue
    }
    if (!response.ok) throw new Error(`City search failed: ${response.status}`)
    const data = await response.json()
    return (data?.features ?? []) as PhotonFeature[]
  }
}

const fetchPlaces = async (
  path: string,
  params: URLSearchParams,
  tags = PLACE_TAGS
) =>
  (await fetchFeatures(path, params, tags))
    .map(featureToCityOption)
    .filter((o): o is CityOption => o !== null)

/**
 * Forward search for autocomplete: places matching a partial name. With
 * `near`, places close to it rank higher (Beaconsfield in England before the
 * one in Canada, for someone in Europe).
 */
export const searchCities = async (
  query: string,
  opts?: {
    near?: { latitude: number; longitude: number } | null
    limit?: number
  }
): Promise<CityOption[]> => {
  const q = query.trim()
  if (!q) return []
  const limit = opts?.limit ?? 6

  // Ask for a few extra: countries and duplicates get dropped.
  const params = new URLSearchParams({ q, limit: String(limit + 4) })
  if (opts?.near) {
    params.set('lat', String(opts.near.latitude))
    params.set('lon', String(opts.near.longitude))
  }
  return dropDuplicates(await fetchPlaces('api/', params)).slice(0, limit)
}

// How far a place of each size reaches, roughly. Used to weigh distance, so
// a town 1.2 km away beats a hamlet 0.9 km away.
const REACH_KM: Record<Exclude<PlaceKind, 'country'>, number> = {
  city: 10,
  town: 3.5,
  village: 1.5,
  hamlet: 0.6,
}

/** Nothing within this distance means we don't know where the user is. */
export const NEARBY_RADIUS_KM = 25

/**
 * The places around a position, most likely first: by distance relative to
 * their size, preferring the country you're actually in (a town across a
 * border is less likely; a small country you're inside, like San Marino, is
 * the place). Places for which `prefer` is true (e.g. ones the group already
 * uses) win close calls. Empty if there's nothing within NEARBY_RADIUS_KM.
 */
export const nearbyCities = async (
  latitude: number,
  longitude: number,
  opts?: { prefer?: (city: CityOption) => boolean }
): Promise<NearbyCity[]> => {
  const around = (limit: number) =>
    new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      limit: String(limit),
      radius: String(NEARBY_RADIUS_KM),
    })
  const [settlements, smallCountries, hereCountry] = await Promise.all([
    fetchPlaces('reverse', around(15), SETTLEMENT_TAGS),
    // Asked for separately: in San Marino or Andorra, dozens of mapped
    // hamlets are closer than the country's centre and would crowd it out.
    // Only a small country's centre can be this close, and bigger ones are
    // dropped anyway.
    fetchPlaces('reverse', around(2), COUNTRY_TAGS).catch(() => []),
    // Which country you're standing in: the nearest mapped thing of any kind
    // (a building, a road…). Only a hint, so if it fails we do without.
    fetchFeatures('reverse', around(1), [])
      .then((f) => f[0]?.properties?.countrycode?.toUpperCase())
      .catch(() => undefined),
  ])
  const places = [...smallCountries, ...settlements]

  const score = (c: NearbyCity) => {
    // Inside a country that's small enough to be one place: that's it.
    if (c.kind === 'country' && c.countryCode === hereCountry) return 0
    const reach =
      c.kind === 'country' ? (c.reachKm ?? 1) : REACH_KM[c.kind ?? 'village']
    return (
      (c.distanceKm / reach) *
      (hereCountry && c.countryCode !== hereCountry ? 2 : 1) *
      (opts?.prefer?.(c) ? 0.8 : 1)
    )
  }

  return dropDuplicates(places)
    .map((c) => ({
      ...c,
      distanceKm: kmBetween(latitude, longitude, c.latitude, c.longitude),
    }))
    .filter((c) => c.distanceKm <= NEARBY_RADIUS_KM)
    .sort((a, b) => score(a) - score(b))
}
