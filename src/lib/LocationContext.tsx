'use client'
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react'

import { useAuth } from '@/lib/AuthContext'
import { toDate } from '@/lib/dates'
import { getAllLocations, LocationEntry } from '@/lib/firebase'
import { LocationData } from '@/lib/types'

interface LocationContextType {
  locationData: LocationData[]
  refreshLocations: () => Promise<void>
  removeLocation: (userId: string, locationId: string) => void
  updateUserLocally: (userId: string, changes: Partial<LocationData>) => void
  updateLocation: (
    userId: string,
    locationId: string,
    changes: Partial<LocationEntry>
  ) => void
  addLocation: (
    userId: string,
    location: LocationEntry,
    userMeta?: { userName: string | null; photoURL: string | null }
  ) => void
  // A counter bumped to request the map fly to the current user's pin.
  flySignal: number
  requestFlyToMyLocation: () => void
  // A place the map should fly to when it next shows (e.g. "Show on map" on
  // the stats page); the map clears it once it has flown there.
  flyTarget: { lat: number; lng: number } | null
  setFlyTarget: (target: { lat: number; lng: number } | null) => void
  isLoading: boolean
}

const LocationContext = createContext<LocationContextType | undefined>(
  undefined
)

export const LocationProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth()
  const [locationData, setLocationData] = useState<LocationData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [flySignal, setFlySignal] = useState(0)
  const [flyTarget, setFlyTarget] = useState<{
    lat: number
    lng: number
  } | null>(null)

  const requestFlyToMyLocation = () => setFlySignal((s) => s + 1)

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

  // Remove a single location from local state without refetching everything.
  // Used after a successful Firestore delete so the UI updates instantly.
  const removeLocation = (userId: string, locationId: string) => {
    setLocationData((prev) =>
      prev.map((u) =>
        u.userId === userId
          ? {
              ...u,
              locations: u.locations.filter((l) => l.id !== locationId),
            }
          : u
      )
    )
  }

  // Update a user's fields (e.g. profile name/photo) in local state.
  const updateUserLocally = (
    userId: string,
    changes: Partial<LocationData>
  ) => {
    setLocationData((prev) =>
      prev.some((u) => u.userId === userId)
        ? prev.map((u) => (u.userId === userId ? { ...u, ...changes } : u))
        : [
            ...prev,
            {
              userId,
              userName: null,
              photoURL: null,
              lastLogin: null,
              locations: [],
              ...changes,
            },
          ]
    )
  }

  // Update a single location's fields in local state without refetching.
  const updateLocation = (
    userId: string,
    locationId: string,
    changes: Partial<LocationEntry>
  ) => {
    setLocationData((prev) =>
      prev.map((u) =>
        u.userId === userId
          ? {
              ...u,
              // Re-sort newest-first: an edited time can move the entry.
              locations: u.locations
                .map((l) => (l.id === locationId ? { ...l, ...changes } : l))
                .sort(
                  (a, b) =>
                    toDate(b.createdAt).getTime() -
                    toDate(a.createdAt).getTime()
                ),
            }
          : u
      )
    )
  }

  // Insert a single location into local state without refetching everything.
  // Used after a successful Firestore write so the new pin/entry appears
  // instantly. If the user has no entry yet, create one from userMeta.
  const addLocation = (
    userId: string,
    location: LocationEntry,
    userMeta?: { userName: string | null; photoURL: string | null }
  ) => {
    // Sort newest-first so a manually-added past entry lands in the right slot.
    const toMillis = (d: LocationEntry['createdAt']) =>
      d instanceof Date ? d.getTime() : d.toMillis()
    const byNewest = (a: LocationEntry, b: LocationEntry) =>
      toMillis(b.createdAt) - toMillis(a.createdAt)

    setLocationData((prev) => {
      const exists = prev.some((u) => u.userId === userId)
      if (exists) {
        return prev.map((u) =>
          u.userId === userId
            ? { ...u, locations: [location, ...u.locations].sort(byNewest) }
            : u
        )
      }
      return [
        ...prev,
        {
          userId,
          userName: userMeta?.userName ?? null,
          photoURL: userMeta?.photoURL ?? null,
          lastLogin: null,
          locations: [location],
        },
      ]
    })
  }

  // Initial load — wait until auth has resolved before reading Firestore,
  // otherwise the request goes out unauthenticated and the security rules
  // reject it with permission-denied.
  useEffect(() => {
    if (loading) return // auth state not yet known
    if (!user) {
      // Signed out: nothing to load, and an unauthenticated read would fail.
      setLocationData([])
      setIsLoading(false)
      return
    }
    refreshLocations()
  }, [user, loading])

  return (
    <LocationContext.Provider
      value={{
        locationData,
        refreshLocations,
        removeLocation,
        updateUserLocally,
        updateLocation,
        addLocation,
        flySignal,
        requestFlyToMyLocation,
        flyTarget,
        setFlyTarget,
        isLoading,
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
