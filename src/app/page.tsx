// src/app/page.tsx
'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { LocationSelect } from '@/components/CitySelect'
import Container from '@/components/Container'
import { useAuth } from '@/lib/AuthContext'
import { TITLE } from '@/lib/constants'

const MapWithNoSSR = dynamic(() => import('@/components/Map'), {
  loading: () => (
    <div className="flex h-[500px] items-center justify-center bg-gray-100">
      Loading map...
    </div>
  ),
  ssr: false,
})

const Home = () => {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [loading, user, router])

  if (loading || !user) {
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
          <MapWithNoSSR />
          <LocationSelect />
        </Container>
      </div>
    </main>
  )
}

export default Home
