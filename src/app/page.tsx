// src/app/page.tsx
'use client'

import { Timestamp } from 'firebase/firestore'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { LocationSelect } from '@/components/CitySelect'
import Container from '@/components/Container'
import { useAuth } from '@/lib/AuthContext'
import { TITLE } from '@/lib/constants'
import { getAllLocations, LocationEntry } from '@/lib/firebase'

const MapWithNoSSR = dynamic(() => import('@/components/Map'), {
  loading: () => (
    <div className="flex h-[500px] items-center justify-center bg-gray-100">
      Loading map...
    </div>
  ),
  ssr: false,
})

export interface LocationData {
  userId: string
  photoURL: string | null
  lastLogin: Timestamp | null
  locations: LocationEntry[]
}

const Home = () => {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [locationData, setLocationData] = useState<LocationData[]>([])
  const [loadingLocationData, setLoadingLocationData] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [loading, user, router])

  useEffect(() => {
    async function fetchData() {
      try {
        setLoadingLocationData(true)
        const locationsPromises = await getAllLocations()
        // Resolve all the promises from map
        const resolvedLocations = await Promise.all(locationsPromises)
        setLocationData(resolvedLocations)
      } catch (error) {
        console.error('Error fetching locations:', error)
      } finally {
        setLoadingLocationData(false)
      }
    }

    fetchData()
  }, [])

  if (loadingLocationData || loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        Loading...
      </div>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-4">
      <div className="w-full max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">{TITLE}</h1>
        </div>
        <Container className="flex flex-col gap-4">
          <MapWithNoSSR locationData={locationData} />
          <LocationSelect />
        </Container>
      </div>
    </main>
  )
}

export default Home
