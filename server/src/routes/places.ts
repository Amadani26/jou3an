import { Router } from 'express'
import {
  searchAreas,
  PlacesConfigError,
  type AreaSuggestion,
} from '../services/googlePlaces'

const router = Router()

const MIN_QUERY_LEN = 2
const MAX_RESULTS = 5
const CACHE_TTL_MS = 10 * 60 * 1000
const CACHE_MAX_ENTRIES = 500

/**
 * Tiny in-memory cache so a user typing "d-e-i-r-a" doesn't bill five Text
 * Search calls, and so repeat searches are free. Process-local and lossy by
 * design — it's a cost guard, not a source of truth.
 */
const cache = new Map<string, { expires: number; results: AreaSuggestion[] }>()

const normalize = (q: string) => q.trim().toLowerCase().replace(/\s+/g, ' ')

function readCache(key: string): AreaSuggestion[] | null {
  const hit = cache.get(key)
  if (!hit) return null
  if (hit.expires < Date.now()) {
    cache.delete(key)
    return null
  }
  return hit.results
}

function writeCache(key: string, results: AreaSuggestion[]) {
  // Cheap bound: drop the oldest insertion when full (Map preserves order).
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next()
    if (!oldest.done) cache.delete(oldest.value)
  }
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, results })
}

/**
 * GET /api/places/search-area?q=
 *
 * Dubai-restricted place search for the Decide flow's "Pick an area" step.
 * Returns at most 5 { name, area, lat, lng }. The Places API key stays on the
 * server; Google's own error bodies are never forwarded.
 */
router.get('/search-area', async (req, res) => {
  const raw = typeof req.query.q === 'string' ? req.query.q : ''
  const query = normalize(raw)

  if (query.length < MIN_QUERY_LEN) {
    res.status(400).json({ error: 'Query must be at least 2 characters' })
    return
  }

  const cached = readCache(query)
  if (cached) {
    res.json({ results: cached, cached: true })
    return
  }

  try {
    const results = await searchAreas(query, MAX_RESULTS)
    writeCache(query, results)
    res.json({ results, cached: false })
  } catch (err) {
    if (err instanceof PlacesConfigError) {
      res.status(503).json({ error: 'Place search is not configured' })
      return
    }
    res.status(502).json({ error: 'Place search is unavailable' })
  }
})

export default router
