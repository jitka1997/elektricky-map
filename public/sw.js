/* Offline caching for the Električky PWA.
   - Same-origin app shell (pages + static assets).
   - Images (cross-origin too): Google avatars and OpenStreetMap tiles you've
     already viewed, so they show offline. Firestore and other cross-origin
     requests are left untouched (Firestore has its own IndexedDB cache). */
const SHELL_CACHE = 'elektricky-shell-v1'
const IMAGE_CACHE = 'elektricky-img-v1'
const KEEP = [SHELL_CACHE, IMAGE_CACHE]

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => !KEEP.includes(key))
          .map((key) => caches.delete(key))
      )
      await self.clients.claim()
    })()
  )
})

// Cache-first for images (works for cross-origin/opaque responses too). Once an
// avatar or map tile has loaded, it's served from cache — including offline.
const imageCacheFirst = async (request) => {
  const cache = await caches.open(IMAGE_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response && (response.ok || response.type === 'opaque')) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return cached || Response.error()
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  // Images (avatars, tiles, icons) — cache-first, cross-origin allowed.
  if (request.destination === 'image') {
    event.respondWith(imageCacheFirst(request))
    return
  }

  // Anything else cross-origin (e.g. Firestore) — don't intercept.
  if (new URL(request.url).origin !== self.location.origin) return

  // Navigations: network-first (stay fresh), fall back to cache when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request)
          const cache = await caches.open(SHELL_CACHE)
          cache.put(request, response.clone())
          return response
        } catch {
          const cache = await caches.open(SHELL_CACHE)
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
      const cache = await caches.open(SHELL_CACHE)
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
