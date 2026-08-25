import { Router } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { decideRestaurants } from '../services/decisionEngine'
import { optionalAuth, requireAuth } from '../middleware/auth'
import { photoProxyPath, withPhotoUrlsAll } from '../lib/photos'

const router = Router()

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const querySchema = z.object({
  prompt: z.string().min(1, 'prompt is required'),
  moodChips: z.array(z.string()).default([]),
  userId: z.string().optional(),
})

// POST /api/decisions/query — works anonymously; associates the logged-in user when a token is present
router.post('/query', optionalAuth, async (req, res) => {
  const parsed = querySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() })
    return
  }
  const { prompt, moodChips, userId } = parsed.data

  const restaurants = await prisma.restaurant.findMany({ where: { isActive: true } })
  const results = decideRestaurants(prompt, moodChips, restaurants)

  // Prefer the authenticated user; fall back to a body userId that exists (FK safety)
  let validUserId: string | null = req.userId ?? null
  if (!validUserId && userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (user) validUserId = user.id
  }

  const session = await prisma.decisionSession.create({
    data: {
      userId: validUserId,
      promptText: prompt,
      moodChipsUsed: moodChips,
      resultIds: results.map((r) => r.id),
    },
  })

  res.json({ results: withPhotoUrlsAll(results), sessionId: session.id })
})

const tinderSchema = z.object({
  likedIds: z.array(z.string()).default([]),
})

// POST /api/decisions/tinder-suggest — 3 picks from the swiped-right list
// (falls back to random active restaurants when there aren't enough likes).
// Placeholder logic for now; Phase 4 will make this AI-driven.
router.post('/tinder-suggest', optionalAuth, async (req, res) => {
  const parsed = tinderSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() })
    return
  }
  const { likedIds } = parsed.data

  const liked = likedIds.length
    ? await prisma.restaurant.findMany({
        where: { id: { in: likedIds }, isActive: true },
      })
    : []

  // Top up with other active restaurants if we don't have 3 likes yet.
  let pool = liked
  if (pool.length < 3) {
    const actives = await prisma.restaurant.findMany({ where: { isActive: true } })
    const seen = new Set(pool.map((r) => r.id))
    pool = [...pool, ...actives.filter((r) => !seen.has(r.id))]
  }

  const results = shuffle(pool).slice(0, 3)

  const session = await prisma.decisionSession.create({
    data: {
      userId: req.userId ?? null,
      promptText: 'Tinder suggestions',
      moodChipsUsed: [],
      resultIds: results.map((r) => r.id),
    },
  })

  res.json({ results: withPhotoUrlsAll(results), sessionId: session.id })
})

// GET /api/decisions/history — the signed-in user's picks (selection made),
// most recent first, joined with the selected restaurant. Max 50.
router.get('/history', requireAuth, async (req, res) => {
  const sessions = await prisma.decisionSession.findMany({
    where: { userId: req.userId, selectedResultId: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  // selectedResultId is a plain string (no FK relation) — join manually.
  const ids = [...new Set(sessions.map((s) => s.selectedResultId as string))]
  const restaurants = ids.length
    ? await prisma.restaurant.findMany({ where: { id: { in: ids } } })
    : []
  const byId = new Map(restaurants.map((r) => [r.id, r]))

  const history = sessions.flatMap((s) => {
    const r = byId.get(s.selectedResultId as string)
    if (!r) return [] // selected restaurant was deleted — skip
    return [
      {
        id: s.id,
        restaurantId: r.id,
        restaurantName: r.name,
        cuisine: r.cuisineType,
        area: r.area,
        priceRange: `AED ${r.priceMin}–${r.priceMax}`,
        actionTaken: s.actionTaken,
        createdAt: s.createdAt,
        // Extras so the mobile RestaurantDetailSheet can render on tap:
        tags: r.tags,
        // ratingScore stays for ranking/back-compat; googleRating (0–5) is
        // what the app actually displays.
        ratingScore: r.ratingScore,
        googleRating: r.googleRating,
        calories: r.averageCalories,
        photoUrls: r.photoRefs.map(photoProxyPath),
      },
    ]
  })

  res.json(history)
})

const selectSchema = z.object({
  selectedResultId: z.string().min(1),
  actionTaken: z.enum(['DIRECTIONS', 'CALL', 'ORDER', 'SELECT']),
})

// PATCH /api/decisions/:sessionId/select
router.patch('/:sessionId/select', async (req, res) => {
  const parsed = selectSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() })
    return
  }

  try {
    const session = await prisma.decisionSession.update({
      where: { id: req.params.sessionId },
      data: {
        selectedResultId: parsed.data.selectedResultId,
        actionTaken: parsed.data.actionTaken,
      },
    })
    res.json({ session })
  } catch {
    res.status(404).json({ error: 'Decision session not found' })
  }
})

export default router
