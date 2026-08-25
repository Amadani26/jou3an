import { Router } from 'express'
import { Readable } from 'node:stream'
import { isValidPhotoName, photoMediaUrl, PlacesConfigError } from '../services/googlePlaces'

const router = Router()

const MAX_WIDTH_PX = 800
const CACHE_CONTROL = 'public, max-age=86400'

/**
 * GET /api/photos/places/{placeId}/photos/{photoId}
 *
 * Streams a Places photo through the server so the API key never reaches a
 * client. The resource name contains slashes, hence the Express 5 wildcard
 * (`/*photoRef` → req.params.photoRef is the array of path segments).
 */
router.get('/*photoRef', async (req, res) => {
  const raw = (req.params as Record<string, string | string[]>).photoRef
  const photoName = Array.isArray(raw) ? raw.join('/') : String(raw ?? '')

  // Strict allow-list on the shape — this value goes into an outbound URL.
  if (!isValidPhotoName(photoName)) {
    res.status(400).json({ error: 'Invalid photo reference' })
    return
  }

  try {
    // fetch follows the Places media redirect and hands back the image bytes.
    const upstream = await fetch(photoMediaUrl(photoName, MAX_WIDTH_PX))

    if (!upstream.ok || !upstream.body) {
      // Never forward Google's body — it can echo the request URL (with key).
      res.status(upstream.status === 404 ? 404 : 502).json({
        error: 'Unable to load photo',
      })
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
  } catch (err) {
    if (err instanceof PlacesConfigError) {
      res.status(503).json({ error: 'Photo service is not configured' })
      return
    }
    res.status(502).json({ error: 'Unable to load photo' })
  }
})

export default router
