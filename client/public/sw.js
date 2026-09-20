/* Jou3an service worker */

/*
 * ⚠️ BUMP THIS on any change to APP_SHELL or to the caching strategy below.
 * `activate` deletes every cache whose key !== CACHE_NAME, so bumping is what
 * evicts a previous deploy's entries from existing visitors.
 *
 * v3: navigations are NETWORK-FIRST. v2 served them cache-first, which meant a
 * returning visitor got the *cached* index.html — pointing at hashed bundles
 * that no longer exist after a deploy — i.e. a permanent white screen that no
 * amount of reloading could fix, because the reload was answered from the same
 * cache. The bump also purges the stale HTML v2 left behind.
 */
const CACHE_NAME = 'jou3an-v3'

// Core app shell. Only ever used as an OFFLINE fallback for navigations now;
// hashed JS/CSS bundles are cached at runtime (their names are not known ahead
// of time in a Vite build).
const APP_SHELL = [
  '/',
  '/index.html',
  '/site.webmanifest',
  '/brand/jou3an-logo.png',
  '/brand/jou3an-icon-180.png',
  '/brand/jou3an-icon-512.png',
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

  // ---------------------------------------------------------------------
  // Navigations (i.e. the HTML document): NETWORK-FIRST, always.
  //
  // index.html is the one file that must never be served stale: it carries the
  // hashed bundle filenames, so a cached copy from an older deploy points at
  // assets the server has already dropped. Cache is the offline fallback only.
  // ---------------------------------------------------------------------
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put('/index.html', copy))
            .catch(() => {})
          return response
        })
        .catch(() =>
          caches
            .match('/index.html')
            .then((cached) => cached || caches.match('/')),
        ),
    )
    return
  }

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

  // Cache-first for everything else. Safe because what lands here is either a
  // content-hashed bundle under /assets/ (immutable by construction) or a
  // static brand file — never the HTML, which is handled above.
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
        .catch(() => undefined)
    }),
  )
})
