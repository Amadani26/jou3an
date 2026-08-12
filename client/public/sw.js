/* Jou3an service worker */
const CACHE_NAME = 'jou3an-v1'

// Core app shell to pre-cache. Hashed JS/CSS bundles are cached at runtime
// (their names are not known ahead of time in a Vite build).
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

function isApiRequest(url) {
  return url.pathname.includes('/api/') || url.pathname === '/health'
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Only handle GET; let the browser deal with the rest (POST/PATCH, etc.)
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Network-first for API calls (fresh data, cache as offline fallback)
  if (isApiRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(() => caches.match(request)),
    )
    return
  }

  // Cache-first for everything else (static assets + app shell)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request)
        .then((response) => {
          // Cache successful same-origin GETs at runtime
          if (
            response &&
            response.status === 200 &&
            url.origin === self.location.origin
          ) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => {
          // SPA navigation fallback
          if (request.mode === 'navigate') return caches.match('/index.html')
          return undefined
        })
    }),
  )
})
