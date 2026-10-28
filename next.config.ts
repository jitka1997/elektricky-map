import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    // Every page is a static shell that gets its data from Firestore in the
    // browser, so a page Next.js has prefetched only goes out of date with a
    // new deploy. Keep it for a day instead of 5 minutes: switching pages then
    // never waits on the network, even on a bad connection.
    staleTimes: { static: 24 * 60 * 60 },
  },
}

export default nextConfig
