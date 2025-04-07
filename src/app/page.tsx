'use client'

import dynamic from 'next/dynamic'

const Home = () => {
  const Map = dynamic(() => import('../components/Map'), {
    loading: () => (
      <div className="h-[500px] flex items-center justify-center bg-gray-100">
        Loading map...
      </div>
    ),
    ssr: false,
  })

  return (
    <main className="flex min-h-screen flex-col items-center p-4">
      <h1 className="text-3xl font-bold mb-4">Find your favorite Električka</h1>
      <div className="w-full max-w-4xl">
        <Map />
      </div>
    </main>
  )
}

export default Home
