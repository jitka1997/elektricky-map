'use client'

import { useEffect } from 'react'

// Registers the PWA service worker (public/sw.js) once, on the client.
const ServiceWorkerRegister = () => {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((error) =>
          console.error('Service worker registration failed:', error)
        )
    }
  }, [])

  return null
}

export default ServiceWorkerRegister
