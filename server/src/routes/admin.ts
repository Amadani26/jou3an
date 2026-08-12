import { Router } from 'express'
import { z } from 'zod'
import { LocationArea } from '@prisma/client'
import prisma from '../lib/prisma'
import { requireAuth, requireAdmin } from '../middleware/auth'

const router = Router()

// Every admin route requires a valid token AND the admin email.
router.use(requireAuth, requireAdmin)

const dailyInclude = { result1: true, result2: true, result3: true } as const

/* ------------------------------------------------------------------ */
/* POST /api/admin/daily — set (upsert) today's Top 3                   */
/* ------------------------------------------------------------------ */

const dailySchema = z.object({
  themeLabel: z.string().min(1),
  result1Id: z.string().min(1),
  result2Id: z.string().min(1),
  result3Id: z.string().min(1),
})

router.post('/daily', async (req, res) => {
  const parsed = dailySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() })
    return
  }
  const { themeLabel, result1Id, result2Id, result3Id } = parsed.data

  // Ensure the referenced restaurants exist (clearer error than an FK failure)
  const count = await prisma.restaurant.count({
    where: { id: { in: [result1Id, result2Id, result3Id] } },
  })
  if (count < 3) {
    res.status(400).json({ error: 'One or more restaurant ids are invalid' })
    return
  }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const data = { themeLabel, result1Id, result2Id, result3Id, isLive: true }
  const pick = await prisma.dailyPick.upsert({
    where: { date: today },
    update: data,
    create: { date: today, ...data },
    include: dailyInclude,
  })

  res.json(pick)
})

/* ------------------------------------------------------------------ */
/* GET /api/admin/restaurants — paginated (50 per page)                */
/* ------------------------------------------------------------------ */

router.get('/restaurants', async (req, res) => {
  const pageSize = 50
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1)

  const [total, restaurants] = await Promise.all([
    prisma.restaurant.count(),
    prisma.restaurant.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  res.json({
    restaurants,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  })
})

/* ------------------------------------------------------------------ */
/* POST /api/admin/restaurants — create                                */
/* ------------------------------------------------------------------ */

const restaurantSchema = z.object({
  name: z.string().min(1),
  cuisineType: z.string().min(1),
  area: z.nativeEnum(LocationArea),
  priceMin: z.number().int().nonnegative(),
  priceMax: z.number().int().nonnegative(),
  phone: z.string().nullish(),
  googleMapsUrl: z.string().nullish(),
  talabatUrl: z.string().nullish(),
  noonUrl: z.string().nullish(),
  deliverooUrl: z.string().nullish(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  ratingScore: z.number().min(0).max(5).optional(),
  averageCalories: z.number().int().nullish(),
})

router.post('/restaurants', async (req, res) => {
  const parsed = restaurantSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() })
    return
  }
  const restaurant = await prisma.restaurant.create({
    data: { ...parsed.data, tags: parsed.data.tags ?? [] },
  })
  res.status(201).json(restaurant)
})

/* ------------------------------------------------------------------ */
/* PATCH /api/admin/restaurants/:id — update / toggle                  */
/* ------------------------------------------------------------------ */

const restaurantUpdateSchema = restaurantSchema.partial()

router.patch('/restaurants/:id', async (req, res) => {
  const parsed = restaurantUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() })
    return
  }
  try {
    const restaurant = await prisma.restaurant.update({
      where: { id: req.params.id },
      data: parsed.data,
    })
    res.json(restaurant)
  } catch {
    res.status(404).json({ error: 'Restaurant not found' })
  }
})

export default router
