import React, { useState } from 'react'
import Select from 'react-select'
import Container from '@/components/Container'
import { getNearestCity } from '@/lib/utils/getNearestCity'

interface CityOption {
  value: string
  label: string
  country: string
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
    { value: 'london', label: 'London', country: 'United Kingdom' },
    {
      value: 'new-york',
      label: 'New York',
      country: 'United States',
      state: 'NY',
    },
    { value: 'tokyo', label: 'Tokyo', country: 'Japan' },
    { value: 'paris', label: 'Paris', country: 'France' },
    { value: 'berlin', label: 'Berlin', country: 'Germany' },
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

  const handleCityChange = (city: CityOption | null) => {
    setSelectedCity(city)
    // TODO: write to DB or something
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
      }

      // Update the selected city
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
      <Container className="flex items-center justify-center gap-4">
        <CitySelect
          label="Your City"
          value={selectedCity}
          onChange={handleCityChange}
          required
        />

        <button
          onClick={findCityByGeolocation}
          disabled={isLoading}
          className="bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-blue-300"
        >
          {isLoading ? 'Finding location...' : 'Use My Location'}
        </button>
      </Container>
      {isLoading && <div className="text-gray-500">Loading...</div>}

      {error && <div className="text-red-500 text-sm">{error}</div>}

      {selectedCity && (
        <Container className="bg-gray-50 p-4 rounded-md">
          <h2 className="font-medium">Selected Location:</h2>
          <p>
            {selectedCity.label},{' '}
            {selectedCity.state && `${selectedCity.state}, `}
            {selectedCity.country}
          </p>
        </Container>
      )}
    </>
  )
}

export { LocationSelect }
