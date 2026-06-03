/**
 * Geocoding helpers backed by Photon (https://photon.komoot.io), an
 * OpenStreetMap-based geocoder built for search-as-you-type. Unlike Nominatim
 * it has no 1-request/second autocomplete restriction, so it's safe to call on
 * every keystroke (debounced).
 */

const PHOTON_BASE = 'https://photon.komoot.io'

// Only surface populated places in autocomplete, not streets/buildings.
const PLACE_TAGS = ['place:city', 'place:town', 'place:village', 'place:hamlet']

export type CityOption = {
  city: string
  country: string
  state?: string
  latitude: number
  longitude: number
}

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] }
  properties?: {
    name?: string
    city?: string
    town?: string
    village?: string
    state?: string
    county?: string
    country?: string
  }
}

/** Build a human-readable label like "Bratislava, Slovakia". */
export const formatCity = (city: CityOption): string =>
  [city.city, city.state, city.country].filter(Boolean).join(', ')

/** Convert a Photon GeoJSON feature into a CityOption (or null if unusable). */
const featureToCityOption = (feature: PhotonFeature): CityOption | null => {
  const props = feature.properties
  const coords = feature.geometry?.coordinates
  if (!props || !coords) return null

  const city = props.name || props.city || props.town || props.village
  if (!city) return null

  return {
    city,
    country: props.country || 'Unknown',
    state: props.state || props.county || undefined,
    // GeoJSON coordinates are [longitude, latitude].
    latitude: coords[1],
    longitude: coords[0],
  }
}

/**
 * Forward search for autocomplete. Returns city-level matches for a partial
 * query, optionally biased toward a given lat/lon.
 */
export const searchCities = async (
  query: string,
  opts?: { latitude?: number; longitude?: number; limit?: number }
): Promise<CityOption[]> => {
  const q = query.trim()
  if (!q) return []

  const params = new URLSearchParams()
  params.set('q', q)
  params.set('lang', 'en')
  params.set('limit', String(opts?.limit ?? 6))
  if (opts?.latitude != null && opts?.longitude != null) {
    params.set('lat', String(opts.latitude))
    params.set('lon', String(opts.longitude))
  }
  for (const tag of PLACE_TAGS) params.append('osm_tag', tag)

  const response = await fetch(`${PHOTON_BASE}/api/?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`City search failed: ${response.status}`)
  }

  const data = await response.json()
  const features: PhotonFeature[] = data?.features ?? []

  // Map to CityOptions and drop duplicates (same city/state/country).
  const seen = new Set<string>()
  const results: CityOption[] = []
  for (const feature of features) {
    const option = featureToCityOption(feature)
    if (!option) continue
    const key = `${option.city}|${option.state ?? ''}|${option.country}`
    if (seen.has(key)) continue
    seen.add(key)
    results.push(option)
  }
  return results
}

/**
 * Reverse-geocode coordinates to the surrounding locality (city/town/village).
 * Returns the place name plus state/country, or null if none found.
 */
export const reverseGeocodeCity = async (
  latitude: number,
  longitude: number
): Promise<{ city: string; state?: string; country: string } | null> => {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    lang: 'en',
  })

  const response = await fetch(`${PHOTON_BASE}/reverse?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`Reverse geocoding failed: ${response.status}`)
  }

  const data = await response.json()
  const props: PhotonFeature['properties'] = data?.features?.[0]?.properties
  if (!props) return null

  const city = props.city || props.name || props.town || props.village
  if (!city) return null

  return {
    city,
    state: props.state || props.county || undefined,
    country: props.country || 'Unknown',
  }
}

/**
 * Resolve device coordinates to a city-level CityOption: reverse-geocode to the
 * city name, then forward-search it so the stored coordinates are the city's,
 * not the user's exact GPS position (privacy-preserving).
 */
export const cityOptionFromCoords = async (
  latitude: number,
  longitude: number
): Promise<CityOption | null> => {
  const place = await reverseGeocodeCity(latitude, longitude)
  if (!place) return null

  const queryParts = [place.city, place.state, place.country].filter(Boolean)
  const matches = await searchCities(queryParts.join(', '), {
    latitude,
    longitude,
    limit: 1,
  })
  return matches[0] ?? null
}