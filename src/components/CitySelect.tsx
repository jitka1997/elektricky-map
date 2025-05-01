import { serverTimestamp, Timestamp } from 'firebase/firestore'
import React, { useState } from 'react'

import Container from '@/components/Container'
import { useAuth } from '@/lib/AuthContext'
import { writeToFirestore } from '@/lib/firebase'
import { getCityCoordinates, getNearestCity } from '@/lib/utils'

interface CityOption {
  city: string
  country: string
  latitude: number
  longitude: number
  state?: string
}

const LocationSelect: React.FC = () => {
  const [selectedCity, setSelectedCity] = useState<CityOption | null>(null)
  const [newCityFound, setNewCityFound] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const submitLocationToFirestore = async () => {
    try {
      if (!user) throw new Error('User not authenticated')
      if (!selectedCity) throw new Error('No city selected')

      await writeToFirestore({
        collection: 'locations',
        docId: user.uid,
        data: {
          userId: user.uid,
          city: selectedCity.city,
          country: selectedCity.country,
          latitude: selectedCity.latitude,
          longitude: selectedCity.longitude,
          createdAt: serverTimestamp() as unknown as Timestamp,
        },
      })

      setNewCityFound(false)
    } catch (error) {
      console.error('Error writing location to Firestore:', error)
      setError('Failed to save location')
    }
  }

  const findCityByGeolocation = async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by your browser')
      }

      // Get current position
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject)
        }
      )

      const { latitude, longitude } = position.coords
      const cityInfo = await getNearestCity(latitude, longitude)

      if (!cityInfo) {
        throw new Error('Could not determine your city')
      }

      const { name, state, country } = cityInfo
      const scatteredCoors = await getCityCoordinates(name, country, state)

      if (!scatteredCoors) {
        throw new Error('Could not get city coordinates')
      }

      const cityOption: CityOption = {
        city: name,
        country: country,
        state: state,
        latitude: scatteredCoors.scatteredLatitude,
        longitude: scatteredCoors.scatteredLongitude,
      }

      setSelectedCity(cityOption)
      setNewCityFound(true)
    } catch (err) {
      console.error('Error finding location:', err)
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Container className="flex items-center justify-between gap-4 rounded-md bg-gray-100 py-4">
        <div className="flex flex-col gap-2">
          <h2 className="font-bold">Selected Location:</h2>
          {selectedCity ? (
            <p>
              {selectedCity.city},{' '}
              {selectedCity.state && `${selectedCity.state}, `}
              {selectedCity.country}
            </p>
          ) : (
            <p>{isLoading ? 'Finding location...' : 'No location selected'}</p>
          )}
        </div>
        {selectedCity && newCityFound ? (
          <button
            onClick={submitLocationToFirestore}
            disabled={!selectedCity}
            className="btn btn-primary"
          >
            Upload Location
          </button>
        ) : (
          <button
            onClick={findCityByGeolocation}
            disabled={isLoading}
            className="btn btn-primary"
          >
            {isLoading ? 'Finding location...' : 'Get My Location'}
          </button>
        )}
      </Container>
      {error && <div className="text-sm text-red-500">{error}</div>}
    </>
  )
}

export { LocationSelect }
