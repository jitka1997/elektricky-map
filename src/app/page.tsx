// src/app/page.tsx
'use client'

import { useAuth } from '@/lib/AuthContext'
import Login from '@/components/Login'
import dynamic from 'next/dynamic'

const TITLE = 'Find your favorite Električka'

const MapWithNoSSR = dynamic(() => import('@/components/Map'), {
  loading: () => (
    <div className="h-[500px] flex items-center justify-center bg-gray-100">
      Loading map...
    </div>
  ),
  ssr: false,
})

const Home = () => {
  const { user, loading, logout } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        Loading...
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center p-4">
        <h1 className="text-3xl font-bold mb-8">{TITLE}</h1>
        <Login />
      </div>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-4">
      <div className="w-full max-w-6xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">{TITLE}</h1>
          <div>
            <span className="mr-3">{user.displayName || user.email}</span>
            <button
              onClick={() => logout()}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
            >
              Logout
            </button>
          </div>
        </div>
        <MapWithNoSSR />
      </div>
    </main>
  )
}

export default Home
