import { Router } from 'express'
import prisma from '../lib/prisma'
import { withPhotoUrls, withPhotoUrlsAll } from '../lib/photos'

const router = Router()

// GET /api/restaurants/nearby?lat=&lng=&radius=5000
// NOTE: real geo filtering isn't wired yet (no lat/lng columns in the DB), so this
// returns all active restaurants regardless of the params. lat/lng/radius are accepted
// now for forward-compatibility; wire distance filtering once coordinates exist.
// Must be declared BEFORE '/:id' so "nearby" isn't matched as an id.
router.get('/nearby', async (_req, res) => {
  const restaurants = await prisma.restaurant.findMany({ where: { isActive: true } })
  res.json(withPhotoUrlsAll(restaurants))
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
