import { serverTimestamp, Timestamp } from 'firebase/firestore'
import React, { useState } from 'react'
import Select from 'react-select'

import Container from '@/components/Container'
import { useAuth } from '@/lib/AuthContext'
import { writeToFirestore } from '@/lib/firebase'
import { getNearestCity } from '@/lib/utils'

interface CityOption {
  value: string
  label: string
  country: string
  latitude: number
  longitude: number
  state?: string
}

interface CitySelectProps {
  label?: string
  onChange?: (option: CityOption | null) => void
  value?: CityOption | null
  required?: boolean
}

const CitySelect: React.FC<CitySelectProps> = ({ onChange, value }) => {
  // TODO: Fetch city options from somewhere
  const cityOptions: CityOption[] = [
    {
      value: 'london',
      label: 'London',
      country: 'United Kingdom',
      latitude: 51.5074,
      longitude: -0.1278,
    },
    {
      value: 'new-york',
      label: 'New York',
      country: 'United States',
      state: 'NY',
      latitude: 40.7128,
      longitude: -74.006,
    },
    {
      value: 'tokyo',
      label: 'Tokyo',
      country: 'Japan',
      latitude: 35.682839,
      longitude: 139.759455,
    },
    {
      value: 'paris',
      label: 'Paris',
      country: 'France',
      latitude: 48.8566,
      longitude: 2.3522,
    },
    {
      value: 'berlin',
      label: 'Berlin',
      country: 'Germany',
      latitude: 52.52,
      longitude: 13.405,
    },
  ]

  return (
    <Select
      options={cityOptions}
      value={value}
      onChange={(selected) =>
        onChange && onChange(selected as CityOption | null)
      }
      placeholder="Select a city..."
      className="w-full"
      isClearable
    />
  )
}

const LocationSelect: React.FC = () => {
  const [selectedCity, setSelectedCity] = useState<CityOption | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const handleCityChange = (city: CityOption | null) => {
    setSelectedCity(city)
    console.log('Selected city:', city)
  }

  const submitLocationToFirestore = async () => {
    try {
      if (!user) throw new Error('User not authenticated')
      if (!selectedCity) throw new Error('No city selected')

      await writeToFirestore({
        collection: 'locations',
        docId: `${user.uid}_${Date.now()}`,
        data: {
          userId: user.uid,
          city: selectedCity.value,
          country: selectedCity.country,
          latitude: selectedCity.latitude,
          longitude: selectedCity.longitude,
          createdAt: serverTimestamp() as unknown as Timestamp,
        },
      })
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

      const cityOption: CityOption = {
        value: cityInfo.name.toLowerCase().replace(/\s+/g, '-'), // Create a URL-friendly value
        label: cityInfo.name,
        country: cityInfo.country,
        state: cityInfo.state,
        latitude: latitude,
        longitude: longitude,
      }

      setSelectedCity(cityOption)
    } catch (err) {
      console.error('Error finding location:', err)
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Container className="flex items-center justify-center gap-4 pl-0">
        <CitySelect
          label="Your City"
          value={selectedCity}
          onChange={handleCityChange}
          required
        />

        <button
          onClick={findCityByGeolocation}
          disabled={isLoading}
          className="btn btn-primary"
        >
          {isLoading ? 'Finding location...' : 'Get My Location'}
        </button>
      </Container>
      {isLoading && <div className="text-gray-500">Loading...</div>}

      {error && <div className="text-sm text-red-500">{error}</div>}

      {selectedCity && (
        <Container className="flex items-center justify-between gap-4 rounded-md bg-gray-100 py-4">
          <div className="flex flex-col gap-2">
            <h2 className="font-bold">Selected Location:</h2>
            <p>
              {selectedCity.label},{' '}
              {selectedCity.state && `${selectedCity.state}, `}
              {selectedCity.country}
            </p>
          </div>
          {/* // TODO: hide until next location is selected */}
          <button
            onClick={submitLocationToFirestore}
            disabled={!selectedCity}
            className="btn btn-primary"
          >
            Upload Location
          </button>
        </Container>
      )}
    </>
  )
}

export { LocationSelect }
