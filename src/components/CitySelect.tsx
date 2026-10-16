'use client'

import { serverTimestamp, Timestamp } from 'firebase/firestore'
import React, { useEffect, useState } from 'react'

import CitySearch from '@/components/CitySearch'
import Container from '@/components/Container'
import TravelModePicker from '@/components/TravelModePicker'
import { useAuth } from '@/lib/AuthContext'
import { toDateTimeLocal } from '@/lib/dates'
import { writeLocationToFirestore } from '@/lib/firebase'
import { useLocations } from '@/lib/LocationContext'
import { neighborsAt, pastLocations, sameCity } from '@/lib/locations'
import { shortName } from '@/lib/names'
import { notifyNewEntry } from '@/lib/push'
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
  // After logging: which friends are already in that city (a pop-up that
  // closes itself after a few seconds).
  const [meetMessage, setMeetMessage] = useState<string | null>(null)
  useEffect(() => {
    if (!meetMessage) return
    const timer = setTimeout(() => setMeetMessage(null), 8000)
    return () => clearTimeout(timer)
  }, [meetMessage])
  // Bumped after a successful submit to remount CitySearch and clear its input.
  const [resetKey, setResetKey] = useState(0)
  const { user } = useAuth()
  const { locationData, requestFlyToMyLocation, now } = useLocations()

  // The time this entry would be logged at (now, unless changed).
  const logTime = customTime ? new Date(dateTime).getTime() : now

  // Block a consecutive duplicate: the picked city matches the entry right
  // before or after the log time.
  const myLocations =
    locationData.find((u) => u.userId === user?.uid)?.locations ?? []
  const isAdjacentSame = (() => {
    if (!selectedCity || isNaN(logTime)) return false
    const { newer, older } = neighborsAt(myLocations, logTime)
    return sameCity(selectedCity, newer) || sameCity(selectedCity, older)
  })()

  // "Bára is in Vienna too!" when friends' latest entry is that city.
  const friendsThereMessage = (city: CityOption, when: Date | null) => {
    const now = Date.now()
    const names = locationData
      .filter((u) => u.userId !== user?.uid)
      .filter((u) => sameCity(city, pastLocations(u.locations ?? [], now)[0]))
      .map((u) => shortName(u.userName, u.customName) || 'An Električka')
    if (!names.length) return null
    const who =
      names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
    const verb = names.length === 1 ? 'is' : 'are'
    if (when && when.getTime() > now + 10 * 60 * 1000)
      return `${who} ${verb} in ${city.city} right now.`
    if (when && when.getTime() < now - 3 * 60 * 60 * 1000) return null
    return `🎉 ${who} ${verb} in ${city.city} too!`
  }

  const startCustomTime = () => {
    setDateTime(toDateTimeLocal(new Date()))
    setCustomTime(true)
  }

  const submitLocationToFirestore = async () => {
    setError(null)
    setMeetMessage(null)
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

      // Električky in that city get a notification (for now or planned).
      // The new pin shows up by itself: the live data includes our own
      // writes straight away.
      notifyNewEntry(id)
      setMeetMessage(friendsThereMessage(selectedCity, when))

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
      {meetMessage && (
        <div className="pointer-events-none fixed inset-x-0 top-[72px] z-[2000] flex justify-center px-4">
          <div
            role="status"
            className="bg-neutral text-neutral-content rounded-box pointer-events-auto flex max-w-md items-center gap-3 px-5 py-4 text-lg font-semibold shadow-xl motion-safe:animate-[meet-in_0.3s_ease-out]"
          >
            <span>{meetMessage}</span>
            <button
              type="button"
              onClick={() => setMeetMessage(null)}
              className="btn btn-ghost btn-sm btn-circle text-neutral-content"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export { LocationSelect }
