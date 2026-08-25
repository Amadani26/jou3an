import { Router } from 'express'
import prisma from '../lib/prisma'
import { withPhotoUrls, withPhotoUrlsAll } from '../lib/photos'
import { withinRadius } from '../lib/geo'

const router = Router()

const DEFAULT_RADIUS_KM = 5

/**
 * GET /api/restaurants/nearby?lat=&lng=&radius=
 *
 * With coordinates: active restaurants within `radius` km (default 5), each
 * carrying `distanceKm`, nearest first. Without coordinates: all active, as
 * before. `radius` is in KILOMETRES.
 *
 * Must be declared BEFORE '/:id' so "nearby" isn't matched as an id.
 */
router.get('/nearby', async (req, res) => {
  const restaurants = await prisma.restaurant.findMany({ where: { isActive: true } })

  const lat = Number(req.query.lat)
  const lng = Number(req.query.lng)
  const hasOrigin = Number.isFinite(lat) && Number.isFinite(lng)

  if (!hasOrigin) {
    res.json(withPhotoUrlsAll(restaurants))
    return
  }

  const parsedRadius = Number(req.query.radius)
  const radiusKm =
    Number.isFinite(parsedRadius) && parsedRadius > 0 ? parsedRadius : DEFAULT_RADIUS_KM

  const nearby = withinRadius(restaurants, { lat, lng }, radiusKm)
  res.json(withPhotoUrlsAll(nearby))
})

// GET /api/restaurants/:id
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
