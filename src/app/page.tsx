// src/app/page.tsx
'use client'

import { useAuth } from '@/lib/AuthContext'
import dynamic from 'next/dynamic'
import { TITLE } from '@/lib/constants'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const MapWithNoSSR = dynamic(() => import('@/components/Map'), {
  loading: () => (
    <div className="h-[500px] flex items-center justify-center bg-gray-100">
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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">{TITLE}</h1>
        </div>
        <MapWithNoSSR />
      </div>
    </main>
  )
}

export default Home
