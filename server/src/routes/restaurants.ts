import { Router } from 'express'
import prisma from '../lib/prisma'

const router = Router()

// GET /api/restaurants/:id
router.get('/:id', async (req, res) => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: req.params.id },
  })
  if (!restaurant) {
    res.status(404).json({ error: 'Restaurant not found' })
    return
  }
  res.json(restaurant)
})

export default router
