/**
 * The onboarding taste quiz — answers in, engine inputs out.
 *
 * The quiz is three questions, and each one lands somewhere different in the
 * engine. Keeping that translation in one place is the point of this file: the
 * route stays about HTTP, and the two endpoints that can change these answers
 * (`POST /me/taste-quiz` and `PATCH /me/preferences`) cannot drift apart.
 *
 *   cuisines to skip   -> UserTasteProfile.quizWeights  -2 each (SOFT)
 *   budget band        -> User.budgetRange, the default price-fit context
 *   adventurousness    -> User.adventurousness, the per-user base wildcard ε
 *
 * Two fields the quiz no longer ASKS about are still handled here, because
 * `PATCH /me/preferences` can set them and stored answers must keep working:
 *   loved cuisines     -> UserTasteProfile.quizWeights  +2 each
 *   dietary needs      -> User.dietary, a Stage-1 EXCLUSION (src/lib/dietary.ts)
 *
 * ⚠️ NOTHING here is a hard filter except dietary. A skipped cuisine is a -2
 * taste weight, so a skipped-cuisine restaurant with an outstanding rating can
 * still win a slot — and the ε-wildcard ignores taste entirely by design. "I'd
 * rather skip Japanese" is a lean, not a ban, and the quiz copy says so.
 *
 * ⚠️ IDEMPOTENT BY CONSTRUCTION. Nothing here applies a delta to anything. The
 * answers are stored, and `quizWeights` is RECOMPUTED from them, so taking the
 * quiz five times is indistinguishable from taking it once. The learned
 * `weights` column — the one real swipes and selections move — is never
 * touched; the engine reads the sum of the two.
 */
import type { Adventurousness, BudgetRange } from '@prisma/client'
import prisma from '../lib/prisma'
import { knownNeeds } from '../lib/dietary'
import { normalizeCuisine, saveQuizWeights } from './tasteProfile'

/**
 * The quiz caps loved cuisines so the signal stays meaningful: a user who
 * "loves" everything has told the engine nothing, and the UI enforces the same
 * limit. Extra picks are dropped rather than rejected — a client that gets this
 * wrong should still save the first five, not fail the whole quiz.
 */
export const MAX_LOVED_CUISINES = 5

/** What a quiz submission can set. Every field is optional — it is skippable. */
export interface TasteQuizAnswers {
  lovedCuisines?: string[]
  dislikedCuisines?: string[]
  dietary?: string[]
  /** NULL is a real answer — the "No budget" card. See NormalizedAnswers. */
  budgetRange?: BudgetRange | null
  adventurousness?: Adventurousness
}

/** De-duplicates case-insensitively while keeping the user's own spelling. */
function dedupe(values: readonly string[], limit = Number.POSITIVE_INFINITY): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const value = String(raw).trim()
    if (!value) continue
    const key = normalizeCuisine(value)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
    if (out.length >= limit) break
  }
  return out
}

export interface NormalizedAnswers {
  lovedCuisines?: string[]
  dislikedCuisines?: string[]
  dietary?: string[]
  /**
   * ⚠️ THREE states, all meaningful: absent leaves the stored band alone, a
   * band sets it, and explicit NULL clears it — which is how "No budget" is
   * stored, and the only way a user can un-say a band they once chose.
   */
  budgetRange?: BudgetRange | null
  adventurousness?: Adventurousness
}

/**
 * Cleans a submission without deciding anything.
 *
 * ⚠️ Absent and empty are DIFFERENT and both are meaningful: an absent field
 * leaves the stored answer alone (which is how `PATCH /me/preferences` can
 * change one thing), while an explicitly empty array CLEARS it — that is how a
 * user un-says "I avoid seafood".
 */
export function normalizeAnswers(answers: TasteQuizAnswers): NormalizedAnswers {
  const out: NormalizedAnswers = {}

  if (answers.lovedCuisines !== undefined) {
    out.lovedCuisines = dedupe(answers.lovedCuisines, MAX_LOVED_CUISINES)
  }
  if (answers.dislikedCuisines !== undefined) {
    out.dislikedCuisines = dedupe(answers.dislikedCuisines)
  }
  if (answers.dietary !== undefined) {
    // Stored as the canonical slugs the filter understands, so what the engine
    // reads and what Profile displays can never disagree.
    out.dietary = knownNeeds(answers.dietary)
  }
  if (answers.budgetRange !== undefined) out.budgetRange = answers.budgetRange ?? null
  if (answers.adventurousness !== undefined) {
    out.adventurousness = answers.adventurousness
  }

  return out
}

/**
 * Persists a submission and re-derives everything the engine reads from it.
 *
 * `markCompleted` is what separates the two callers: finishing the quiz stamps
 * `tasteQuizCompletedAt`, while editing one preference from Profile should not
 * retroactively claim the quiz was taken.
 */
export async function saveTasteQuiz(
  userId: string,
  answers: TasteQuizAnswers,
  opts: { markCompleted?: boolean } = {},
) {
  const normalized = normalizeAnswers(answers)

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      // Loved cuisines live in the existing column — they are the same thing
      // the Profile screen has always called "cuisine preferences".
      ...(normalized.lovedCuisines !== undefined
        ? { cuisinePreferences: normalized.lovedCuisines }
        : {}),
      ...(normalized.dislikedCuisines !== undefined
        ? { dislikedCuisines: normalized.dislikedCuisines }
        : {}),
      ...(normalized.dietary !== undefined ? { dietary: normalized.dietary } : {}),
      ...(normalized.budgetRange !== undefined
        ? { budgetRange: normalized.budgetRange }
        : {}),
      ...(normalized.adventurousness !== undefined
        ? { adventurousness: normalized.adventurousness }
        : {}),
      ...(opts.markCompleted ? { tasteQuizCompletedAt: new Date() } : {}),
    },
  })

  // Recompute from what is now STORED, not from what was submitted: a partial
  // edit from Profile must still produce weights consistent with both lists.
  const quizWeights = await saveQuizWeights(
    userId,
    user.cuisinePreferences,
    user.dislikedCuisines,
  )

  return { user, quizWeights }
}
