/**
 * DecisionEngine v2 — learned taste profiles.
 *
 * One `UserTasteProfile` row per user holds a flat map of cuisine/tag -> weight.
 * Every swipe and every selection nudges it, and the whole map decays slightly
 * on each update so old enthusiasm fades instead of dominating forever.
 */
import type { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'

export type TasteEvent = 'SWIPE_RIGHT' | 'SWIPE_LEFT' | 'SELECT'

/** How much each signal moves a cuisine's weight. */
export const EVENT_DELTA: Record<TasteEvent, number> = {
  SWIPE_RIGHT: 1,
  SWIPE_LEFT: -0.25,
  SELECT: 3,
}

/**
 * Applied to EVERY weight before each delta, so a cuisine the user has stopped
 * engaging with drifts back toward neutral. Mild on purpose: at 0.98 a weight
 * keeps ~82% of its value after 10 updates and ~13% after 100.
 */
export const DECAY = 0.98

/** Weights are clamped so no single cuisine can run away with the score. */
export const WEIGHT_MIN = -5
export const WEIGHT_MAX = 10

/** Below this a weight is noise; dropping it keeps the JSON blob small. */
const PRUNE_BELOW = 0.01

export type TasteWeights = Record<string, number>

/** Cuisines arrive from Google, seed data and user input — normalise hard. */
export const normalizeCuisine = (c: string) => c.trim().toLowerCase()

const clamp = (n: number) => Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, n))

/** Defensive read: the Json column is `unknown` as far as the type system goes. */
export function coerceWeights(raw: unknown): TasteWeights {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: TasteWeights = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
  }
  return out
}

/**
 * Pure core: decay everything, then apply one event's delta to one cuisine.
 *
 * Split out from the DB write so the maths is testable on its own and so the
 * engine can replay a profile forward without touching Postgres.
 */
export function applyEventToWeights(
  weights: TasteWeights,
  cuisine: string,
  event: TasteEvent,
): TasteWeights {
  const key = normalizeCuisine(cuisine)
  if (!key) return { ...weights }

  const next: TasteWeights = {}

  // Decay first, so the incoming delta lands at full strength.
  for (const [k, v] of Object.entries(weights)) {
    const decayed = v * DECAY
    if (Math.abs(decayed) >= PRUNE_BELOW) next[k] = decayed
  }

  next[key] = clamp((next[key] ?? 0) + EVENT_DELTA[event])

  // A delta can land a weight back inside the prune window (e.g. a lone
  // SWIPE_LEFT on an unseen cuisine); keep it anyway — it is a real signal.
  return next
}

/**
 * Record one taste event and persist the updated profile.
 *
 * No-ops for anonymous callers: a null userId means we have nowhere to attach
 * the learning, and inventing a profile row would break the FK.
 */
export async function applyTasteEvent(
  userId: string | null | undefined,
  cuisine: string,
  event: TasteEvent,
): Promise<TasteWeights | null> {
  if (!userId || !cuisine?.trim()) return null

  const existing = await prisma.userTasteProfile.findUnique({ where: { userId } })
  const weights = applyEventToWeights(coerceWeights(existing?.weights), cuisine, event)

  await prisma.userTasteProfile.upsert({
    where: { userId },
    create: { userId, weights: weights as Prisma.InputJsonValue },
    update: { weights: weights as Prisma.InputJsonValue },
  })

  return weights
}

/**
 * Batch form for the swipe log — one decay pass per event, applied in order, a
 * single read and a single write. Doing this through `applyTasteEvent` in a
 * loop would decay correctly but cost 2N queries.
 */
export async function applyTasteEvents(
  userId: string | null | undefined,
  events: { cuisine: string; event: TasteEvent }[],
): Promise<TasteWeights | null> {
  if (!userId || !events.length) return null

  const existing = await prisma.userTasteProfile.findUnique({ where: { userId } })
  let weights = coerceWeights(existing?.weights)
  for (const e of events) {
    if (!e.cuisine?.trim()) continue
    weights = applyEventToWeights(weights, e.cuisine, e.event)
  }

  await prisma.userTasteProfile.upsert({
    where: { userId },
    create: { userId, weights: weights as Prisma.InputJsonValue },
    update: { weights: weights as Prisma.InputJsonValue },
  })

  return weights
}

/** Current LEARNED weights for a user; `{}` for anonymous or not-yet-learned. */
export async function getTasteWeights(
  userId: string | null | undefined,
): Promise<TasteWeights> {
  if (!userId) return {}
  const row = await prisma.userTasteProfile.findUnique({ where: { userId } })
  return coerceWeights(row?.weights)
}

/* ------------------------------------------------------------------ */
/* The onboarding taste quiz's contribution                            */
/* ------------------------------------------------------------------ */

/** How much a quiz answer is worth. A SELECT (+3) still outweighs a claim. */
export const QUIZ_LOVE_DELTA = 2
export const QUIZ_DISLIKE_DELTA = -2

/**
 * The quiz's own weights, derived PURELY from its stored answers.
 *
 * ⚠️ This is the whole idempotency story. The quiz never applies a delta to the
 * learned `weights` column; it recomputes this map from scratch and overwrites
 * `quizWeights`, so re-taking the quiz ten times leaves +2, not +20. Nothing
 * here decays either — a stated preference is not a stale signal, it is a
 * standing one, and it only changes when the user changes their answer.
 *
 * A cuisine on both lists resolves to DISLIKE: "I avoid this" is the more
 * specific, more recently-considered statement, and serving it anyway is the
 * worse failure.
 */
export function quizWeightsFrom(
  lovedCuisines: readonly string[] | null | undefined,
  dislikedCuisines: readonly string[] | null | undefined,
): TasteWeights {
  const out: TasteWeights = {}

  for (const raw of lovedCuisines ?? []) {
    const key = normalizeCuisine(String(raw))
    if (key) out[key] = QUIZ_LOVE_DELTA
  }
  // Applied second so it wins a collision.
  for (const raw of dislikedCuisines ?? []) {
    const key = normalizeCuisine(String(raw))
    if (key) out[key] = QUIZ_DISLIKE_DELTA
  }

  return out
}

/**
 * What the engine actually scores against: learned + quiz, summed and clamped.
 *
 * Additive on purpose — the spec for the quiz is that it SEEDS the profile
 * without overwriting it. A user who swiped right on Japanese ten times and
 * then said they love Japanese should end up more enthusiastic than either
 * signal alone, not reset to +2.
 */
export function effectiveTasteWeights(
  learned: TasteWeights,
  quiz: TasteWeights,
): TasteWeights {
  const out: TasteWeights = {}
  for (const key of new Set([...Object.keys(learned), ...Object.keys(quiz)])) {
    out[key] = clamp((learned[key] ?? 0) + (quiz[key] ?? 0))
  }
  return out
}

/** Effective weights for a user — one query, both columns. */
export async function getEffectiveTasteWeights(
  userId: string | null | undefined,
): Promise<TasteWeights> {
  if (!userId) return {}
  const row = await prisma.userTasteProfile.findUnique({ where: { userId } })
  if (!row) return {}
  return effectiveTasteWeights(coerceWeights(row.weights), coerceWeights(row.quizWeights))
}

/**
 * Persist the quiz's contribution, leaving the learned column untouched.
 *
 * Upserts rather than requiring a profile to exist: most users take the quiz
 * before they have ever swiped, so this is usually the row's birth.
 */
export async function saveQuizWeights(
  userId: string,
  lovedCuisines: readonly string[] | null | undefined,
  dislikedCuisines: readonly string[] | null | undefined,
): Promise<TasteWeights> {
  const quizWeights = quizWeightsFrom(lovedCuisines, dislikedCuisines)

  await prisma.userTasteProfile.upsert({
    where: { userId },
    create: { userId, quizWeights: quizWeights as Prisma.InputJsonValue },
    // ⚠️ `weights` is deliberately absent — a quiz save must never move the
    // swipe/select-learned column.
    update: { quizWeights: quizWeights as Prisma.InputJsonValue },
  })

  return quizWeights
}
