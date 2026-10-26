'use client'

import React, { useEffect, useId, useRef, useState } from 'react'

import { useAuth } from '@/lib/AuthContext'
import { useLocations } from '@/lib/LocationContext'
import { pastLocations } from '@/lib/locations'
import { resolvePlace } from '@/lib/places'
import {
  CityOption,
  formatCity,
  NEARBY_RADIUS_KM,
  nearbyCities,
  NearbyCity,
  normalizeName,
  searchCities,
} from '@/lib/utils'

interface Props {
  value: CityOption | null
  onSelect: (city: CityOption | null) => void
}

// Maps a GeolocationPositionError code to an actionable message.
const GEO_ERROR_MESSAGES: Record<number, string> = {
  1: 'Location permission is blocked for this site. Click the icon at the left of the address bar, allow Location, then reload the page. (Location also requires an https:// or localhost address.)',
  2: 'Your location is currently unavailable. Make sure your device location services are on and try again.',
  3: 'Timed out while getting your location. Please try again.',
}

const CitySearch: React.FC<Props> = ({ value, onSelect }) => {
  const [query, setQuery] = useState<string>(value ? formatCity(value) : '')
  // Search results and the text they were found for. They only show while
  // that's still what's typed, so nothing needs resetting when it changes.
  const [results, setResults] = useState<{
    query: string
    cities: CityOption[]
    failed: boolean
  }>({ query: '', cities: [], failed: false })
  // Bumped by "Try again" to repeat a search that failed.
  const [attempt, setAttempt] = useState(0)
  // The search that has been running for a while (to say it's still going).
  const [slowQuery, setSlowQuery] = useState<string | null>(null)
  // "Use my current location": getting the position, then asking Photon
  // which city it is (the slow part when Photon is busy).
  const [locating, setLocating] = useState<
    null | 'position' | 'city' | 'city-slow'
  >(null)
  const isLocating = locating !== null
  const [error, setError] = useState<string | null>(null)
  // After "Use my current location": the place picked for you, the other
  // places nearby ("Not right?"), and how rough the position was.
  const [located, setLocated] = useState<{
    picked: NearbyCity
    others: NearbyCity[]
    roughKm: number | null
  } | null>(null)
  // Index of the keyboard-highlighted suggestion (-1 = none).
  const [activeIndex, setActiveIndex] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const optionId = (i: number) => `${listId}-opt-${i}`

  // Keep the latest selection in a ref so the blur handler (which fires after a
  // delay) can read the current value rather than a stale closure.
  const valueRef = useRef(value)
  useEffect(() => {
    valueRef.current = value
  }, [value])

  // Where you last logged: typed searches rank places near it higher.
  const { user } = useAuth()
  const { locationData, now } = useLocations()
  const lastHere = pastLocations(
    locationData.find((u) => u.userId === user?.uid)?.locations ?? [],
    now
  )[0]
  const nearLat = lastHere?.latitude
  const nearLon = lastHere?.longitude

  // Places anyone in the group has logged; they win close calls when
  // guessing where you are, so everyone ends up using the same place.
  const groupPlaces = new Set(
    locationData.flatMap((u) =>
      u.locations.map(
        (l) => `${normalizeName(l.city)}|${normalizeName(l.country)}`
      )
    )
  )
  const inGroup = (c: CityOption) =>
    groupPlaces.has(`${normalizeName(c.city)}|${normalizeName(c.country)}`)

  // Nothing to search for, or the box already shows the selected city.
  const q = query.trim()
  const searchable = q.length >= 2 && !(value && q === formatCity(value))
  const suggestions = searchable && results.query === q ? results.cities : []
  const isSearching = searchable && results.query !== q
  const searchFailed = searchable && results.query === q && results.failed
  const isSlow = isSearching && slowQuery === q

  // Debounced autocomplete.
  useEffect(() => {
    if (!searchable) return
    // Ignore a slow answer that arrives after the text changed again.
    let cancelled = false
    const slowTimer = setTimeout(() => setSlowQuery(q), 4000)
    const timer = setTimeout(async () => {
      let cities: CityOption[] = []
      let failed = false
      try {
        cities = await searchCities(q, {
          limit: 6,
          near:
            nearLat !== undefined && nearLon !== undefined
              ? { latitude: nearLat, longitude: nearLon }
              : null,
        })
      } catch {
        failed = true
      }
      if (cancelled) return
      setResults({ query: q, cities, failed })
      setActiveIndex(-1)
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
      clearTimeout(slowTimer)
    }
  }, [q, searchable, attempt, nearLat, nearLon])

  const closeSuggestions = () => {
    setResults({ query: q, cities: [], failed: false })
    setActiveIndex(-1)
  }

  const retrySearch = () => {
    setResults({ query: '', cities: [], failed: false })
    setAttempt((n) => n + 1)
  }

  // Picks are saved under the group's name and position for that place, if
  // anyone logged it before (see resolvePlace).
  const pickSuggestion = (city: CityOption) => {
    const saved = resolvePlace(
      city,
      locationData.flatMap((u) => u.locations)
    )
    onSelect(saved)
    setQuery(formatCity(saved))
    closeSuggestions()
  }

  // Fill the select with the user's detected city (a one-shot action, not a
  // mode). After filling, the value can still be edited or cleared.
  const fillFromLocation = async () => {
    setError(null)
    setLocating('position')
    let slowTimer: ReturnType<typeof setTimeout> | undefined
    try {
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by your browser')
      }

      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            (geoError) => {
              reject(
                new Error(GEO_ERROR_MESSAGES[geoError.code] ?? geoError.message)
              )
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          )
        }
      )

      const { latitude, longitude, accuracy } = position.coords
      setLocating('city')
      slowTimer = setTimeout(() => setLocating('city-slow'), 4000)
      const [picked, ...others] = await nearbyCities(latitude, longitude, {
        prefer: inGroup,
      })
      if (!picked) {
        throw new Error(
          `There's no town or village within ${NEARBY_RADIUS_KM} km of you. Type the nearest one instead.`
        )
      }

      pickSuggestion(picked)
      setLocated({
        picked,
        others: others.slice(0, 3),
        // Computers often only know their position from Wi-Fi, to a few km.
        roughKm: accuracy > 2000 ? Math.round(accuracy / 1000) : null,
      })
    } catch (err) {
      // A timed-out lookup is a TimeoutError in Chrome but an AbortError
      // ("Fetch is aborted") in Safari; no connection at all is a TypeError
      // ("Failed to fetch" / "Load failed").
      const unreachable =
        err instanceof TypeError ||
        (err instanceof Error &&
          (err.name === 'TimeoutError' || err.name === 'AbortError'))
      setError(
        unreachable
          ? "City search isn't answering right now. It's a free service that's sometimes down. Please try again in a moment."
          : err instanceof Error
            ? err.message
            : 'An unknown error occurred'
      )
    } finally {
      clearTimeout(slowTimer)
      setLocating(null)
    }
  }

  // "Not right?": switch to another nearby place.
  const pickNearby = (city: NearbyCity) => {
    if (!located) return
    pickSuggestion(city)
    setLocated({
      ...located,
      picked: city,
      others: [located.picked, ...located.others.filter((c) => c !== city)]
        // Keep them in order of distance.
        .sort((a, b) => a.distanceKm - b.distanceKm),
    })
  }

  // "Not right? Type it instead": empty the box, ready to type.
  const typeInstead = () => {
    clearInput()
    inputRef.current?.focus()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setLocated(null)
    setQuery(e.target.value)
    setActiveIndex(-1)
    // Editing the text invalidates any previously selected city.
    if (value) onSelect(null)
  }

  const clearInput = () => {
    setLocated(null)
    setQuery('')
    closeSuggestions()
    onSelect(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        if (suggestions.length === 0) return
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % suggestions.length)
        break
      case 'ArrowUp':
        if (suggestions.length === 0) return
        e.preventDefault()
        setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
        break
      case 'Enter':
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          e.preventDefault()
          setLocated(null)
          pickSuggestion(suggestions[activeIndex])
        }
        break
      case 'Escape':
        // First close the dropdown; if it's already closed, clear the field.
        if (suggestions.length > 0) {
          e.preventDefault()
          closeSuggestions()
        } else if (query) {
          e.preventDefault()
          clearInput()
        }
        break
      case 'Home':
        if (suggestions.length === 0) return
        e.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        if (suggestions.length === 0) return
        e.preventDefault()
        setActiveIndex(suggestions.length - 1)
        break
    }
  }

  // Select-like behaviour: if focus leaves with no valid selection, drop any
  // leftover typed text instead of keeping an invalid value.
  const handleBlur = () => {
    setTimeout(() => {
      if (!valueRef.current) {
        setQuery('')
        closeSuggestions()
      }
    }, 150)
  }

  const isOpen = suggestions.length > 0

  return (
    <div className="flex w-full flex-col gap-1">
      <button
        type="button"
        onClick={fillFromLocation}
        disabled={isLocating}
        className="link text-base-content w-fit text-sm"
      >
        {locating === 'position'
          ? 'Finding your location...'
          : isLocating
            ? 'Finding your city...'
            : '📍 Use my current location'}
      </button>

      <div className="relative w-full">
        <input
          ref={inputRef}
          // "search" + autocomplete off: stops Chrome offering saved
          // addresses for a field it guesses is an address ("city").
          type="search"
          name="elektricky-city-search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={query}
          onChange={handleInputChange}
          onFocus={(e) => e.target.select()}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Search for a city..."
          className="input input-bordered text-base-content placeholder:text-base-content/50 w-full pr-10"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? optionId(activeIndex) : undefined
          }
        />

        {isSearching && (
          <span className="loading loading-spinner loading-sm absolute top-1/2 right-3 -translate-y-1/2" />
        )}
        {query && !isSearching && (
          <button
            type="button"
            onClick={clearInput}
            aria-label="Clear"
            className="btn btn-ghost btn-xs btn-circle absolute top-1/2 right-2 -translate-y-1/2"
          >
            ✕
          </button>
        )}

        {isOpen && (
          <ul
            id={listId}
            role="listbox"
            className="menu bg-base-100 rounded-box absolute z-20 mt-1 w-full shadow-lg"
          >
            {suggestions.map((city, index) => (
              <li key={`${formatCity(city)}-${index}`}>
                <button
                  type="button"
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setLocated(null)
                    pickSuggestion(city)
                  }}
                  className={index === activeIndex ? 'bg-base-300' : ''}
                >
                  {formatCity(city)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {located && value && (
        <div className="mt-1 flex flex-col gap-1 text-sm">
          <span className="opacity-70">
            {located.picked.distanceKm < 1
              ? "You're right there"
              : `Its centre is ${located.picked.distanceKm.toFixed(1)} km away`}
            {located.roughKm &&
              ` · your position is only accurate to about ${located.roughKm} km, so check it`}
          </span>
          {/* Always a way out, even when nothing else is nearby. */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="opacity-70">Not right?</span>
            {located.others.map((city) => (
              <button
                key={`${city.city}-${city.latitude}`}
                type="button"
                onClick={() => pickNearby(city)}
                className="btn btn-outline btn-xs font-normal"
              >
                {city.city}
                <span className="opacity-60">
                  {city.distanceKm.toFixed(1)} km
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={typeInstead}
              className="link text-base-content"
            >
              Type it instead
            </button>
          </div>
        </div>
      )}
      {(isSlow || locating === 'city-slow') && (
        <div className="mt-1 text-sm opacity-70">
          City search is slow right now. Still looking...
        </div>
      )}
      {searchFailed && (
        <div className="mt-1 text-sm">
          City search isn&apos;t answering right now. It&apos;s a free service
          that&apos;s sometimes down.{' '}
          <button type="button" onClick={retrySearch} className="link">
            Try again
          </button>
        </div>
      )}
      {error && <div className="text-sm text-red-500">{error}</div>}
    </div>
  )
}

export default CitySearch
