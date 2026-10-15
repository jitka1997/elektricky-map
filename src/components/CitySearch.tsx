'use client'

import React, { useEffect, useId, useRef, useState } from 'react'

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
  // Search results and the text they were found for. They only show while
  // that's still what's typed, so nothing needs resetting when it changes.
  const [results, setResults] = useState<{
    query: string
    cities: CityOption[]
    failed: boolean
  }>({ query: '', cities: [], failed: false })
  // Bumped by "Try again" to repeat a search that failed.
  const [attempt, setAttempt] = useState(0)
  const [isLocating, setIsLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Index of the keyboard-highlighted suggestion (-1 = none).
  const [activeIndex, setActiveIndex] = useState(-1)

  const listId = useId()
  const optionId = (i: number) => `${listId}-opt-${i}`

  // Keep the latest selection in a ref so the blur handler (which fires after a
  // delay) can read the current value rather than a stale closure.
  const valueRef = useRef(value)
  useEffect(() => {
    valueRef.current = value
  }, [value])

  // Nothing to search for, or the box already shows the selected city.
  const q = query.trim()
  const searchable = q.length >= 2 && !(value && q === formatCity(value))
  const suggestions = searchable && results.query === q ? results.cities : []
  const isSearching = searchable && results.query !== q
  const searchFailed = searchable && results.query === q && results.failed

  // Debounced autocomplete.
  useEffect(() => {
    if (!searchable) return
    // Ignore a slow answer that arrives after the text changed again.
    let cancelled = false
    const timer = setTimeout(async () => {
      let cities: CityOption[] = []
      let failed = false
      try {
        cities = await searchCities(q, { limit: 6 })
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
    }
  }, [q, searchable, attempt])

  const closeSuggestions = () => {
    setResults({ query: q, cities: [], failed: false })
    setActiveIndex(-1)
  }

  const retrySearch = () => {
    setResults({ query: '', cities: [], failed: false })
    setAttempt((n) => n + 1)
  }

  const pickSuggestion = (city: CityOption) => {
    onSelect(city)
    setQuery(formatCity(city))
    closeSuggestions()
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
                new Error(GEO_ERROR_MESSAGES[geoError.code] ?? geoError.message)
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
      setError(
        err instanceof Error && err.name === 'TimeoutError'
          ? "City lookup isn't answering right now. Please try again in a moment."
          : err instanceof Error
            ? err.message
            : 'An unknown error occurred'
      )
    } finally {
      setIsLocating(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setQuery(e.target.value)
    setActiveIndex(-1)
    // Editing the text invalidates any previously selected city.
    if (value) onSelect(null)
  }

  const clearInput = () => {
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
        {isLocating ? 'Finding your location...' : '📍 Use my current location'}
      </button>

      <div className="relative w-full">
        <input
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
                  onClick={() => pickSuggestion(city)}
                  className={index === activeIndex ? 'bg-base-300' : ''}
                >
                  {formatCity(city)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

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
