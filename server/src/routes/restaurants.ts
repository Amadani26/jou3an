import { Router } from 'express'
import prisma from '../lib/prisma'
import { withPhotoUrls, withPhotoUrlsAll } from '../lib/photos'
import { withinRadius } from '../lib/geo'
import { SERVEABLE_WHERE } from '../lib/venueType'

const router = Router()

const DEFAULT_RADIUS_KM = 5

/** Hard ceiling on a page, so a bad `limit` can't ask for the whole catalogue. */
const MAX_LIMIT = 100

/**
 * Cap on the `exclude` list.
 *
 * It rides in the query string, and a few hundred cuids is already ~8 KB. Past
 * this the client is better served by `offset`: exclusion exists to keep a
 * freshly-switched deck from re-showing what was just swiped, not to carry an
 * entire session's history in a URL.
 */
const MAX_EXCLUDE = 300

/** `?exclude=a,b,c` (repeatable). Anything unparseable is simply ignored. */
function parseExclude(raw: unknown): Set<string> {
  const parts = (Array.isArray(raw) ? raw : [raw])
    .filter((v): v is string => typeof v === 'string')
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter(Boolean)
  return new Set(parts.slice(0, MAX_EXCLUDE))
}

/**
 * GET /api/restaurants/nearby?lat=&lng=&radius=
 *
 * With coordinates: servable restaurants within `radius` km (default 5), each
 * carrying `distanceKm`, nearest first. Without coordinates: all servable,
 * ordered by id so paging is stable. `radius` is in KILOMETRES.
 *
 * PAGING (all optional, all additive — a caller that sends none gets exactly
 * what it got before):
 *   `limit`   page size, capped at MAX_LIMIT
 *   `offset`  rows to skip, applied AFTER the radius filter and the exclusions
 *   `exclude` comma-separated ids to omit (e.g. what this session already
 *             swiped), capped at MAX_EXCLUDE
 *
 * The response stays a BARE ARRAY. Food Tinder infers "that's everything" from
 * a short page, which keeps every existing client working — wrapping it in
 * `{ results, hasMore }` would have broken all of them.
 *
 * "Servable" = active AND venueType RESTAURANT: this feeds Food Tinder, whose
 * swipes train the taste profile, so a parked cafe must never appear here.
 *
 * Must be declared BEFORE '/:id' so "nearby" isn't matched as an id.
 */
router.get('/nearby', async (req, res) => {
  // Ordered by id so that, with no coordinates to sort by, `offset` means the
  // same thing from one request to the next.
  const restaurants = await prisma.restaurant.findMany({
    where: SERVEABLE_WHERE,
    orderBy: { id: 'asc' },
  })

  const lat = Number(req.query.lat)
  const lng = Number(req.query.lng)
  const hasOrigin = Number.isFinite(lat) && Number.isFinite(lng)

  let pool = restaurants
  if (hasOrigin) {
    const parsedRadius = Number(req.query.radius)
    const radiusKm =
      Number.isFinite(parsedRadius) && parsedRadius > 0 ? parsedRadius : DEFAULT_RADIUS_KM
    // Annotates distanceKm and sorts nearest-first — itself a stable order.
    pool = withinRadius(restaurants, { lat, lng }, radiusKm)
  }

  const exclude = parseExclude(req.query.exclude)
  if (exclude.size) pool = pool.filter((r) => !exclude.has(r.id))

  const parsedOffset = Number(req.query.offset)
  const offset = Number.isFinite(parsedOffset) && parsedOffset > 0 ? Math.floor(parsedOffset) : 0

  const parsedLimit = Number(req.query.limit)
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(Math.floor(parsedLimit), MAX_LIMIT)
      : null

  const page = limit === null ? pool.slice(offset) : pool.slice(offset, offset + limit)

  res.json(withPhotoUrlsAll(page))
})

/**
 * GET /api/restaurants/:id
 *
 * Deliberately NOT gated on isActive/venueType: a restaurant the user picked
 * before it was pruned or reclassified must still open from their history.
 */
router.get('/:id', async (req, res) => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: req.params.id },
  })
  if (!restaurant) {
    res.status(404).json({ error: 'Restaurant not found' })
    return
  }
  res.json(withPhotoUrls(restaurant))
})

export default router
