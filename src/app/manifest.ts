import type { MetadataRoute } from 'next'

import { TITLE } from '@/lib/constants'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: TITLE,
    short_name: 'Električky',
    description: 'See where your fellow Električky are around the world.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#c1121f',
    theme_color: '#c1121f',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
