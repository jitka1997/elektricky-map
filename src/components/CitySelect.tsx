'use client'

import { serverTimestamp, Timestamp } from 'firebase/firestore'
import React, { useState } from 'react'

import CitySearch from '@/components/CitySearch'
import Container from '@/components/Container'
import { useAuth } from '@/lib/AuthContext'
import { writeLocationToFirestore } from '@/lib/firebase'
import { useLocations } from '@/lib/LocationContext'
import { CityOption } from '@/lib/utils'

const LocationSelect: React.FC = () => {
  const [selectedCity, setSelectedCity] = useState<CityOption | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Bumped after a successful submit to remount CitySearch and clear its input.
  const [resetKey, setResetKey] = useState(0)
  const { user } = useAuth()
  const { addLocation, locationData, requestFlyToMyLocation } = useLocations()

  // The user's most recent logged location, and whether the currently selected
  // city is that same place (logging it again would be a no-op duplicate).
  const myLatest = locationData.find((u) => u.userId === user?.uid)
    ?.locations?.[0]
  const isAlreadyHere = !!(
    selectedCity &&
    myLatest &&
    selectedCity.city.trim().toLowerCase() ===
      myLatest.city.trim().toLowerCase() &&
    selectedCity.country.trim().toLowerCase() ===
      myLatest.country.trim().toLowerCase()
  )

  const submitLocationToFirestore = async () => {
    setError(null)
    try {
      setIsUploading(true)
      if (!user) throw new Error('User not authenticated')
      if (!selectedCity) throw new Error('No city selected')
      if (isAlreadyHere) throw new Error('You are already in this location')

      const newLocation = {
        userId: user.uid,
        city: selectedCity.city,
        country: selectedCity.country,
        latitude: selectedCity.latitude,
        longitude: selectedCity.longitude,
      }

      const id = await writeLocationToFirestore({
        userId: user.uid,
        locationData: {
          ...newLocation,
          createdAt: serverTimestamp() as unknown as Timestamp,
        },
      })

      // Optimistically add to local state so the pin/entry appears instantly
      // without refetching everything. Use a local Date for display.
      addLocation(
        user.uid,
        { ...newLocation, id, createdAt: new Date() },
        { userName: user.displayName, photoURL: user.photoURL }
      )

      setSelectedCity(null)
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
            disabled={!selectedCity || isUploading || isAlreadyHere}
            className="btn btn-primary"
          >
            {isUploading ? 'Uploading...' : 'Update Location'}
          </button>
        </div>
        {isAlreadyHere && (
          <div className="text-base-content/70 mt-2 text-sm">
            You&apos;re already in {selectedCity?.city}.
          </div>
        )}
      </Container>
      {error && <div className="text-sm text-red-500">{error}</div>}
    </>
  )
}

export { LocationSelect }