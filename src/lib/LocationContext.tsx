'use client'
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react'

import { getAllLocations } from '@/lib/firebase'
import { LocationData } from '@/lib/types'

interface LocationContextType {
  locationData: LocationData[]
  refreshLocations: () => Promise<void>
  isLoading: boolean
}

const LocationContext = createContext<LocationContextType | undefined>(
  undefined
)

export const LocationProvider = ({ children }: { children: ReactNode }) => {
  const [locationData, setLocationData] = useState<LocationData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refreshLocations = async () => {
    try {
      setIsLoading(true)
      const locationsPromises = await getAllLocations()
      const resolvedLocations = await Promise.all(locationsPromises)
      setLocationData(resolvedLocations)
    } catch (error) {
      console.error('Error fetching locations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    refreshLocations()
  }, [])

  return (
    <LocationContext.Provider
      value={{ locationData, refreshLocations, isLoading }}
    >
      {children}
    </LocationContext.Provider>
  )
}

export const useLocations = () => {
  const context = useContext(LocationContext)
  if (context === undefined) {
    throw new Error('useLocations must be used within a LocationProvider')
  }
  return context
}
