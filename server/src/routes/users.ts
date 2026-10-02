import { Router } from 'express'
import { z } from 'zod'
import { Adventurousness, BudgetRange, LocationArea } from '@prisma/client'
import prisma from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { DIETARY_NEEDS, dietaryEnforcement } from '../lib/dietary'
import { MAX_LOVED_CUISINES, saveTasteQuiz } from '../services/tasteQuiz'

const router = Router()

/** Never let the hash off the server. Everything else on User is safe to send. */
function sanitize<T extends { passwordHash?: string | null }>(user: T) {
  const { passwordHash: _passwordHash, ...safe } = user
  return safe
}

// GET /api/users/me — current user profile
router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } })
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  res.json(sanitize(user))
})

/**
 * A cuisine name, loosely validated.
 *
 * Deliberately NOT an enum: the quiz's grid is a mobile-side list that will
 * grow, and the catalogue holds 43 distinct cuisine strings. A server enum here
 * would mean a deploy every time a tile is added, and an unknown cuisine is
 * harmless — it becomes a taste weight nothing matches.
 */
const cuisineName = z.string().trim().min(1).max(60)

/** Only needs the Stage-1 filter understands; see src/lib/dietary.ts. */
const dietaryNeed = z.enum(DIETARY_NEEDS)

const preferencesSchema = z.object({
  cuisinePreferences: z.array(cuisineName).max(MAX_LOVED_CUISINES).optional(),
  dislikedCuisines: z.array(cuisineName).max(40).optional(),
  budgetRange: z.nativeEnum(BudgetRange).optional(),
  dietary: z.array(dietaryNeed).optional(),
  adventurousness: z.nativeEnum(Adventurousness).optional(),
  locationArea: z.nativeEnum(LocationArea).optional(),
})

/**
 * PATCH /api/users/me/preferences — change one or more saved preferences.
 *
 * Routes the taste-relevant fields through `saveTasteQuiz` so editing "cuisine
 * preferences" from Profile re-derives `quizWeights` exactly as finishing the
 * quiz does. It does NOT stamp `tasteQuizCompletedAt`: editing one preference
 * is not the same as having answered the quiz.
 */
router.patch('/me/preferences', requireAuth, async (req, res) => {
  const parsed = preferencesSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() })
    return
  }

  const { locationArea, cuisinePreferences, ...quizFields } = parsed.data

  try {
    if (locationArea !== undefined) {
      await prisma.user.update({ where: { id: req.userId! }, data: { locationArea } })
    }

    const { user } = await saveTasteQuiz(req.userId!, {
      ...quizFields,
      // The quiz calls this "cuisines you love"; the column is the same one.
      ...(cuisinePreferences !== undefined ? { lovedCuisines: cuisinePreferences } : {}),
    })

    res.json(sanitize(user))
  } catch {
    res.status(404).json({ error: 'User not found' })
  }
})

const tasteQuizSchema = z.object({
  lovedCuisines: z.array(cuisineName).max(MAX_LOVED_CUISINES).optional(),
  dislikedCuisines: z.array(cuisineName).max(40).optional(),
  dietary: z.array(dietaryNeed).optional(),
  budgetRange: z.nativeEnum(BudgetRange).optional(),
  adventurousness: z.nativeEnum(Adventurousness).optional(),
})

/**
 * POST /api/users/me/taste-quiz — submit the onboarding taste quiz.
 *
 * Every field is optional because the quiz is SKIPPABLE at every step: a user
 * who answers two of four questions still gets those two applied. Submitting it
 * stamps `tasteQuizCompletedAt`, which is how the app knows not to ask again.
 *
 * The response carries `dietaryEnforcement` so the client is told the truth
 * about which declared needs actually filter anything — `no-pork` is stored and
 * displayed but enforced nowhere, and the app should never imply otherwise.
 */
router.post('/me/taste-quiz', requireAuth, async (req, res) => {
  const parsed = tasteQuizSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() })
    return
  }

  try {
    const { user, quizWeights } = await saveTasteQuiz(req.userId!, parsed.data, {
      markCompleted: true,
    })

    res.json({
      user: sanitize(user),
      // What the quiz actually seeded, so the effect is inspectable rather than
      // something the client has to take on faith.
      quizWeights,
      dietary: dietaryEnforcement(user.dietary),
    })
  } catch {
    res.status(404).json({ error: 'User not found' })
  }
})

export default router
