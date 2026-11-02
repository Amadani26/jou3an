import { Router, type Response } from 'express'
import { Readable } from 'node:stream'
import { isValidPhotoName, photoMediaUrl } from '../services/googlePlaces'
import { healPhotoName } from '../services/photoHeal'
import {
  PHOTO_PLACEHOLDER_CONTENT_TYPE,
  PHOTO_PLACEHOLDER_PNG,
} from '../lib/photoPlaceholder'

const router = Router()

const MAX_WIDTH_PX = 800
const CACHE_CONTROL = 'public, max-age=86400'
/**
 * Short on purpose: a placeholder is served while a heal is pending (or
 * queued behind the concurrency cap), and a day-long cache would pin the
 * grey card long after fresh names landed.
 */
const PLACEHOLDER_CACHE_CONTROL = 'public, max-age=120'

/** Google statuses that mean "this photo name is dead" — the heal trigger. */
const STALE_NAME_STATUSES = new Set([400, 403, 404])

/**
 * The branded fallback. Always 200 with real image bytes: every caller is an
 * <Image>/<img>, and an error status or JSON body renders as a broken/empty
 * box — the one thing this route exists to make impossible.
 */
function servePlaceholder(res: Response) {
  res.status(200)
  res.setHeader('Content-Type', PHOTO_PLACEHOLDER_CONTENT_TYPE)
  res.setHeader('Cache-Control', PLACEHOLDER_CACHE_CONTROL)
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  res.end(PHOTO_PLACEHOLDER_PNG)
}

/**
 * GET /api/photos/places/{placeId}/photos/{photoId}
 *
 * Streams a Places photo through the server so the API key never reaches a
 * client. The resource name contains slashes, hence the Express 5 wildcard
 * (`/*photoRef` → req.params.photoRef is the array of path segments).
 *
 * SELF-HEALING: stored photo names are a short-lived cache — Google expires
 * them and answers 400. When that happens this route refreshes the
 * restaurant's names via `healPhotoName` (rate-gated; see photoHealPolicy),
 * retries ONCE with the fresh name, and only then falls back to the branded
 * placeholder. Google's error bodies are never forwarded — they can echo the
 * request URL, key included.
 */
router.get('/*photoRef', async (req, res) => {
  const raw = (req.params as Record<string, string | string[]>).photoRef
  const photoName = Array.isArray(raw) ? raw.join('/') : String(raw ?? '')

  // Strict allow-list on the shape — this value goes into an outbound URL.
  // A malformed ref is a hand-built request, never one of our own URLs, so
  // it gets a plain 400 rather than a placeholder.
  if (!isValidPhotoName(photoName)) {
    res.status(400).json({ error: 'Invalid photo reference' })
    return
  }

  try {
    // fetch follows the Places media redirect and hands back the image bytes.
    let upstream = await fetch(photoMediaUrl(photoName, MAX_WIDTH_PX))

    if (!upstream.ok && STALE_NAME_STATUSES.has(upstream.status)) {
      const fresh = await healPhotoName(photoName)
      if (fresh && fresh !== photoName) {
        upstream = await fetch(photoMediaUrl(fresh, MAX_WIDTH_PX))
      }
    }

    if (!upstream.ok || !upstream.body) {
      servePlaceholder(res)
      return
    }

    res.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') ?? 'image/jpeg',
    )
    res.setHeader('Cache-Control', CACHE_CONTROL)
    // helmet defaults to same-origin CORP, which would block the image for the
    // web client on a different origin.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')

    const length = upstream.headers.get('content-length')
    if (length) res.setHeader('Content-Length', length)

    Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res)
  } catch {
    // Network failure, PlacesConfigError, anything — the app must never show
    // a broken image, so every unhandled path ends at the placeholder.
    servePlaceholder(res)
  }
})

export default router
