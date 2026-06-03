'use client'

import React, { useEffect, useRef, useState } from 'react'

import {
  CityOption,
  cityOptionFromCoords,
  formatCity,
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
  const [suggestions, setSuggestions] = useState<CityOption[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Keep the latest selection in a ref so the blur handler (which fires after a
  // delay) can read the current value rather than a stale closure.
  const valueRef = useRef(value)
  useEffect(() => {
    valueRef.current = value
  }, [value])

  // Debounced autocomplete. Skips when the box already shows the selected city.
  useEffect(() => {
    const q = query.trim()
    // Nothing to search for, or the box already shows the selected city.
    if (q.length < 2 || (value && q === formatCity(value))) {
      setSuggestions([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    const timer = setTimeout(async () => {
      try {
        setSuggestions(await searchCities(q, { limit: 6 }))
      } catch {
        setSuggestions([])
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, value])

  const pickSuggestion = (city: CityOption) => {
    onSelect(city)
    setQuery(formatCity(city))
    setSuggestions([])
  }

  // Fill the select with the user's detected city (a one-shot action, not a
  // mode). After filling, the value can still be edited or cleared.
  const fillFromLocation = async () => {
    setError(null)
    setIsLocating(true)
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
                new Error(
                  GEO_ERROR_MESSAGES[geoError.code] ?? geoError.message
                )
              )
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          )
        }
      )

      const { latitude, longitude } = position.coords
      const city = await cityOptionFromCoords(latitude, longitude)
      if (!city) {
        throw new Error('Could not determine your city')
      }

      pickSuggestion(city)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsLocating(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setQuery(e.target.value)
    // Editing the text invalidates any previously selected city.
    if (value) onSelect(null)
  }

  const clearInput = () => {
    setQuery('')
    setSuggestions([])
    onSelect(null)
  }

  // Select-like behaviour: if focus leaves with no valid selection, drop any
  // leftover typed text instead of keeping an invalid value.
  const handleBlur = () => {
    setTimeout(() => {
      if (!valueRef.current) {
        setQuery('')
        setSuggestions([])
      }
    }, 150)
  }

  return (
    <div className="flex w-full flex-col gap-1">
      <button
        type="button"
        onClick={fillFromLocation}
        disabled={isLocating}
        className="link link-primary w-fit text-sm"
      >
        {isLocating ? 'Finding your location...' : '📍 Use my current location'}
      </button>

      <div className="relative w-full">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={(e) => e.target.select()}
          onBlur={handleBlur}
          placeholder="Search for a city..."
          className="input input-bordered w-full pr-10"
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

        {suggestions.length > 0 && (
          <ul className="menu bg-base-100 rounded-box absolute z-20 mt-1 w-full shadow-lg">
            {suggestions.map((city, index) => (
              <li key={`${formatCity(city)}-${index}`}>
                <button type="button" onClick={() => pickSuggestion(city)}>
                  {formatCity(city)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <div className="text-sm text-red-500">{error}</div>}
    </div>
  )
}

export default CitySearch