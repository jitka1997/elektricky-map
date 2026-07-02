/* Lightweight offline app-shell cache for the Električky PWA. Cross-origin
   requests (Firestore, map tiles) are left untouched — Firestore has its own
   IndexedDB cache. */
const CACHE = 'elektricky-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      )
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  if (new URL(request.url).origin !== self.location.origin) return

  // Navigations: network-first (stay fresh), fall back to cache when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request)
          const cache = await caches.open(CACHE)
          cache.put(request, response.clone())
          return response
        } catch {
          const cache = await caches.open(CACHE)
          return (
            (await cache.match(request)) ||
            (await cache.match('/')) ||
            Response.error()
          )
        }
      })()
    )
    return
  }

  // Same-origin static assets: stale-while-revalidate.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      const cached = await cache.match(request)
      const fetching = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            cache.put(request, response.clone())
          }
          return response
        })
        .catch(() => cached)
      return cached || fetching
    })()
  )
})
