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
  // The current time (ms), shared by everything that splits entries into
  // past and planned. Ticks every minute and whenever entries change.
  now: number
  isLoading: boolean
}

const LocationContext = createContext<LocationContextType | undefined>(
  undefined
)

const fetchAllLocations = async () => Promise.all(await getAllLocations())

export const LocationProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth()
  const [locationData, setLocationData] = useState<LocationData[]>([])
  // A manual refresh in progress.
  const [isLoading, setIsLoading] = useState(false)
  // Whose data is loaded; until it's the signed-in user's, we're loading.
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [flySignal, setFlySignal] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const requestFlyToMyLocation = () => setFlySignal((s) => s + 1)

  const refreshLocations = async () => {
    try {
      setIsLoading(true)
      setLocationData(await fetchAllLocations())
      setNow(Date.now())
    } catch (error) {
      console.error('Error fetching locations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Remove a single location from local state without refetching everything.
  // Used after a successful Firestore delete so the UI updates instantly.
  const removeLocation = (userId: string, locationId: string) => {
    setNow(Date.now())
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
    setNow(Date.now())
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
    setNow(Date.now())
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
    setNow(Date.now())
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
    // Wait for auth; signed out there's nothing to load (and an
    // unauthenticated read would fail).
    if (loading || !user) return
    let cancelled = false
    fetchAllLocations()
      .then((data) => {
        if (cancelled) return
        setLocationData(data)
        setNow(Date.now())
      })
      .catch((error) => console.error('Error fetching locations:', error))
      .finally(() => {
        if (!cancelled) setLoadedFor(user.uid)
      })
    return () => {
      cancelled = true
    }
  }, [user, loading])

  return (
    <LocationContext.Provider
      value={{
        // Signed out: nothing to show, and nothing loading.
        locationData: user ? locationData : [],
        refreshLocations,
        removeLocation,
        updateUserLocally,
        updateLocation,
        addLocation,
        flySignal,
        requestFlyToMyLocation,
        now,
        isLoading: loading || (!!user && (loadedFor !== user.uid || isLoading)),
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
