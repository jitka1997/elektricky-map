'use client'

import { useEffect } from 'react'

// Registers the PWA service worker (public/sw.js) in production only. In
// development the cache would serve stale JS (code changes only showing up on a
// second reload), so there we remove any previously registered worker and its
// caches instead.
const ServiceWorkerRegister = () => {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.forEach((r) => r.unregister()))
      caches?.keys().then((keys) => keys.forEach((key) => caches.delete(key)))
      return
    }

    navigator.serviceWorker
      .register('/sw.js')
      .catch((error) =>
        console.error('Service worker registration failed:', error)
      )
  }, [])

  return null
}

export default ServiceWorkerRegister
