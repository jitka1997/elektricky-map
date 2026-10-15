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

// Push notifications, sent by the API routes in src/app/api (see
// src/lib/server/push.ts for the message format).
self.addEventListener('push', (event) => {
  let message = {}
  try {
    message = event.data ? event.data.json() : {}
  } catch {
    message = { body: event.data?.text() }
  }
  event.waitUntil(
    self.registration.showNotification(message.title || 'Električky', {
      body: message.body,
      icon: '/icons/icon-192.png',
      // Android's status bar: a one-colour tram silhouette (Android paints it
      // white; a full-colour icon would show as a blank square).
      badge: '/icons/badge-96.png',
      tag: message.tag,
      data: { url: message.url || '/' },
      // Android only; iPhones always use the default sound and vibration.
      vibrate: [80, 60, 80, 60, 200],
    })
  )
})

// Tapping a notification opens the app (or brings it to the front) on the
// page the notification points to.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin)
    .href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      const open = windows.find((w) => 'focus' in w)
      if (open) {
        await open.focus()
        if (open.url !== url && 'navigate' in open)
          await open.navigate(url).catch(() => {})
        return
      }
      await self.clients.openWindow(url)
    })()
  )
})
