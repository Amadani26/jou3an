import { Router } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { decideRestaurants } from '../services/decisionEngine'
import { optionalAuth } from '../middleware/auth'

const router = Router()

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

  res.json({ results, sessionId: session.id })
})

const selectSchema = z.object({
  selectedResultId: z.string().min(1),
  actionTaken: z.enum(['DIRECTIONS', 'CALL', 'ORDER']),
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
