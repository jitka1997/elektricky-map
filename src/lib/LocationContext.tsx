'use client'
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react'

import { useAuth } from '@/lib/AuthContext'
import { subscribeToAllLocations } from '@/lib/firebase'
import { LocationData } from '@/lib/types'

interface LocationContextType {
  locationData: LocationData[]
  // A counter bumped to request the map fly to the current user's pin.
  flySignal: number
  requestFlyToMyLocation: () => void
  // The current time (ms), shared by everything that splits entries into
  // past and planned. Ticks every minute and whenever entries change.
  now: number
  isLoading: boolean
}

const LocationContext = createContext<LocationContextType | undefined>(
  undefined
)

export const LocationProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth()
  const [locationData, setLocationData] = useState<LocationData[]>([])
  // Whose data is loaded; until it's the signed-in user's, we're loading.
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [flySignal, setFlySignal] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const requestFlyToMyLocation = () => setFlySignal((s) => s + 1)

  // Everyone's data, kept live: loads once auth has resolved (an
  // unauthenticated read would be rejected by the security rules), then
  // updates whenever anyone logs, edits or deletes, on any device.
  useEffect(() => {
    if (loading || !user) return
    return subscribeToAllLocations(
      (data) => {
        setLocationData(data)
        setNow(Date.now())
        setLoadedFor(user.uid)
      },
      (error) => {
        console.error('Error loading locations:', error)
        setLoadedFor(user.uid)
      }
    )
  }, [user, loading])

  return (
    <LocationContext.Provider
      value={{
        // Signed out: nothing to show, and nothing loading.
        locationData: user ? locationData : [],
        flySignal,
        requestFlyToMyLocation,
        now,
        isLoading: loading || (!!user && loadedFor !== user.uid),
      }}
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
