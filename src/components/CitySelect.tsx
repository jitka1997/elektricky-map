'use client'

import { serverTimestamp, Timestamp } from 'firebase/firestore'
import React, { useState } from 'react'

import CitySearch from '@/components/CitySearch'
import Container from '@/components/Container'
import TravelModePicker from '@/components/TravelModePicker'
import { useAuth } from '@/lib/AuthContext'
import { toDateTimeLocal } from '@/lib/dates'
import { writeLocationToFirestore } from '@/lib/firebase'
import { useLocations } from '@/lib/LocationContext'
import { neighborsAt, sameCity } from '@/lib/locations'
import { DEFAULT_TRAVEL_MODE, TravelMode } from '@/lib/travel'
import { CityOption } from '@/lib/utils'

const LocationSelect: React.FC = () => {
  const [selectedCity, setSelectedCity] = useState<CityOption | null>(null)
  const [travelMode, setTravelMode] = useState<TravelMode>(DEFAULT_TRAVEL_MODE)
  // Logs default to "now"; the user can opt in to a custom date/time.
  const [customTime, setCustomTime] = useState(false)
  const [dateTime, setDateTime] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Bumped after a successful submit to remount CitySearch and clear its input.
  const [resetKey, setResetKey] = useState(0)
  const { user } = useAuth()
  const { addLocation, locationData, requestFlyToMyLocation } = useLocations()

  // The time this entry would be logged at (now, unless changed).
  const logTime = customTime ? new Date(dateTime).getTime() : Date.now()

  // Block a consecutive duplicate: the picked city matches the entry right
  // before or after the log time.
  const myLocations =
    locationData.find((u) => u.userId === user?.uid)?.locations ?? []
  const isAdjacentSame = (() => {
    if (!selectedCity || isNaN(logTime)) return false
    const { newer, older } = neighborsAt(myLocations, logTime)
    return sameCity(selectedCity, newer) || sameCity(selectedCity, older)
  })()

  const startCustomTime = () => {
    setDateTime(toDateTimeLocal(new Date()))
    setCustomTime(true)
  }

  const submitLocationToFirestore = async () => {
    setError(null)
    try {
      setIsUploading(true)
      if (!user) throw new Error('User not authenticated')
      if (!selectedCity) throw new Error('No city selected')
      if (isAdjacentSame) throw new Error('Same as an adjacent entry')
      if (isNaN(logTime)) throw new Error('Invalid date/time')
      const when = customTime ? new Date(dateTime) : null

      const newLocation = {
        userId: user.uid,
        city: selectedCity.city,
        country: selectedCity.country,
        latitude: selectedCity.latitude,
        longitude: selectedCity.longitude,
        travelMode,
      }

      const id = await writeLocationToFirestore({
        userId: user.uid,
        locationData: {
          ...newLocation,
          // Server time for "now"; Firestore converts a custom Date itself.
          createdAt: when ?? (serverTimestamp() as unknown as Timestamp),
        },
      })

      // Optimistically add to local state so the pin/entry appears instantly
      // without refetching everything. Use a local Date for display.
      addLocation(
        user.uid,
        { ...newLocation, id, createdAt: when ?? new Date() },
        { userName: user.displayName, photoURL: user.photoURL }
      )

      setSelectedCity(null)
      setTravelMode(DEFAULT_TRAVEL_MODE)
      setCustomTime(false)
      setResetKey((k) => k + 1)
      // Fly the map to the freshly logged pin.
      requestFlyToMyLocation()
    } catch (err) {
      console.error('Error writing location to Firestore:', err)
      setError('Failed to save location')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <>
      <Container className="bg-base-200 rounded-md py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <CitySearch
              key={resetKey}
              value={selectedCity}
              onSelect={setSelectedCity}
            />
          </div>
          <button
            onClick={submitLocationToFirestore}
            disabled={
              !selectedCity || isUploading || isAdjacentSame || isNaN(logTime)
            }
            className="btn btn-primary"
          >
            {isUploading ? 'Uploading...' : 'Update Location'}
          </button>
        </div>
        <div className="mt-3">
          <TravelModePicker value={travelMode} onChange={setTravelMode} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="label-text">When:</span>
          {customTime ? (
            <>
              <input
                type="datetime-local"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                className="input input-bordered input-sm text-base-content w-auto"
              />
              <button
                type="button"
                onClick={() => setCustomTime(false)}
                className="link text-base-content"
              >
                Use now
              </button>
            </>
          ) : (
            <>
              <span className="font-semibold">Now</span>
              <button
                type="button"
                onClick={startCustomTime}
                className="link text-base-content"
              >
                Change
              </button>
            </>
          )}
        </div>
        {isAdjacentSame && (
          <div className="text-base-content/70 mt-2 text-sm">
            {customTime
              ? 'Same as an adjacent entry — pick a different city or time.'
              : `You're already in ${selectedCity?.city}.`}
          </div>
        )}
      </Container>
      {error && <div className="text-sm text-red-500">{error}</div>}
    </>
  )
}

export { LocationSelect }
