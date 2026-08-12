import { Router } from 'express'
import { z } from 'zod'
import { BudgetRange, LocationArea } from '@prisma/client'
import prisma from '../lib/prisma'
import { requireAuth } from '../middleware/auth'

const router = Router()

// GET /api/users/me — current user profile
router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } })
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  const { passwordHash: _passwordHash, ...safe } = user
  res.json(safe)
})

const preferencesSchema = z.object({
  cuisinePreferences: z.array(z.string()).optional(),
  budgetRange: z.nativeEnum(BudgetRange).optional(),
  dietary: z.array(z.string()).optional(),
  locationArea: z.nativeEnum(LocationArea).optional(),
})

// PATCH /api/users/me/preferences — update preferences
router.patch('/me/preferences', requireAuth, async (req, res) => {
  const parsed = preferencesSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() })
    return
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.userId! },
      data: parsed.data,
    })
    const { passwordHash: _passwordHash, ...safe } = user
    res.json(safe)
  } catch {
    res.status(404).json({ error: 'User not found' })
  }
})

export default router
