'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import Container from '@/components/Container'
import UserIcon from '@/components/UserIcon'
import { useAuth } from '@/lib/AuthContext'
import { useLocations } from '@/lib/LocationContext'

const HistoryPage = () => {
  const { user, loading: authLoading } = useAuth()
  const { locationData, isLoading: locationsLoading } = useLocations()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [authLoading, user, router])

  const loading = authLoading || locationsLoading

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

  // Filter out users with no location data
  const usersWithLocations = locationData.filter(
    (userData) => userData.locations && userData.locations.length > 0
  )

  if (usersWithLocations.length === 0) {
    return (
      <Container className="text-base-content py-8">
        <div className="card bg-base-200 shadow-md">
          <div className="card-body text-center">
            <h2 className="card-title justify-center">No Locations Found</h2>
            <p>No location data available.</p>
          </div>
        </div>
      </Container>
    )
  }

  return (
    <Container className="text-base-content py-8">
      <h1 className="mb-8 text-3xl font-bold">Location History</h1>

      <div className="space-y-10">
        {usersWithLocations.map((userData, userIndex) => {
          // User information
          const { userId, photoURL, locations } = userData

          return (
            <div
              key={userId || userIndex}
              className="card bg-base-200 overflow-hidden shadow-md"
            >
              <div className="card-body p-0">
                {/* User Header */}
                <div className="bg-base-300 flex items-center gap-3 p-4">
                  <UserIcon photoURL={photoURL} />
                  <div>
                    <h2 className="card-title"></h2>
                    <p className="text-sm opacity-70">
                      {locations.length} location
                      {locations.length !== 1 ? 's' : ''} logged
                    </p>
                  </div>
                  {/* TODO: fix so it looks nice, take userName from userData */}
                  {/* <div className="align-end">{userName}</div> */}
                </div>

                {/* Location Listings */}
                <div className="divide-base-200 divide-y">
                  {locations.map((location, locationIndex) => {
                    const date = new Date(location.createdAt.toLocaleString())
                    const formattedDate = date.toLocaleDateString()
                    const formattedTime = date.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })

                    return (
                      <div key={locationIndex} className="p-4">
                        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
                          <div>
                            <h3 className="text-lg font-medium">
                              {location.city}, {location.country}
                            </h3>
                            <div className="flex items-center text-sm opacity-70">
                              {formattedDate} • {formattedTime}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Container>
  )
}

export default HistoryPage
