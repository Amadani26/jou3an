/**
 * DecisionEngine v2 — learned taste profiles ("Taste Vector v2").
 *
 * One `UserTasteProfile` row per user holds a VECTOR: a shared `base` map plus
 * one map per meal context, each keyed by namespaced dimension
 * (`cuisine:japanese`, `tag:steakhouse`, `price:MID`). The representation, the
 * migration from v1's flat cuisine map, and the decay/clamp constants all live
 * in ./tasteDimensions.ts — this file owns the EVENT MATHS and the database.
 *
 * ⚠️ ONE EVENT NOW MOVES EVERY MATCHING DIMENSION. A right-swipe on a
 * mid-priced steakhouse credits `cuisine:american`, `tag:steakhouse`,
 * `tag:date-night` AND `price:MID` — same delta, same decay, same clamp on
 * each. That is the whole upgrade: the old profile could only write down the
 * coarsest fact on the row, so six steakhouses across four cuisines taught it
 * nothing at all.
 */
import type { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'
import {
  CONTEXT_EVENT_SCALE,
  DECAY,
  PRUNE_BELOW,
  WEIGHT_MAX,
  WEIGHT_MIN,
  addToBase,
  clampWeight,
  coerceVector,
  coerceWeights,
  cuisineDimension,
  dimensionsFor,
  emptyVector,
  mealContextFor,
  namespaceLegacyWeights,
  normalizeDimensionValue,
  type DimensionSource,
  type MealContext,
  type TasteVector,
  type TasteWeights,
} from './tasteDimensions'

export type TasteEvent = 'SWIPE_RIGHT' | 'SWIPE_LEFT' | 'SELECT'

/** How much each signal moves every dimension it touches. */
export const EVENT_DELTA: Record<TasteEvent, number> = {
  SWIPE_RIGHT: 1,
  SWIPE_LEFT: -0.25,
  SELECT: 3,
}

// Re-exported so the many existing importers of these names (the engine's
// score.ts, filter.ts, select.ts, tasteQuiz.ts) keep working unchanged.
export {
  DECAY,
  WEIGHT_MAX,
  WEIGHT_MIN,
  coerceWeights,
  coerceVector,
  dimensionsFor,
  mealContextFor,
  type TasteVector,
  type TasteWeights,
}

/** @deprecated Dimension values are no longer only cuisines — see tasteDimensions. */
export const normalizeCuisine = normalizeDimensionValue

/** Decays every weight in one map and drops what has decayed into noise. */
function decayMap(weights: TasteWeights): TasteWeights {
  const out: TasteWeights = {}
  for (const [k, v] of Object.entries(weights)) {
    const decayed = v * DECAY
    if (Math.abs(decayed) >= PRUNE_BELOW) out[k] = decayed
  }
  return out
}

/** Adds one delta to every listed dimension, clamping each. */
function applyDelta(
  weights: TasteWeights,
  dimensions: readonly string[],
  delta: number,
): TasteWeights {
  const out: TasteWeights = { ...weights }
  for (const key of dimensions) {
    if (!key) continue
    out[key] = clampWeight((out[key] ?? 0) + delta)
  }
  return out
}

export interface TasteEventInput {
  /** Dimension keys from `dimensionsFor(restaurant)`. */
  dimensions: readonly string[]
  event: TasteEvent
  /** Which map takes the half-strength half of the delta. */
  meal: MealContext
}

/**
 * Pure core: decay, then apply one event across every matching dimension.
 *
 * ⚠️ Only the two maps being WRITTEN decay — the base and the active meal
 * context. Decaying the other context too would mean a month of dinners erased
 * what we know about the user's lunches, which is the opposite of why the
 * split exists: each context should fade on its own evidence, not on the
 * other's.
 *
 * ⚠️ The delta lands on EVERY dimension at the SAME strength. Weighting them
 * differently here (cuisine louder than a tag, say) would hide a ranking
 * decision inside the learning step, where nothing can see or tune it. The
 * namespaces are weighted once, visibly, at scoring time — see
 * TASTE_NAMESPACE_WEIGHTS in engine/config.ts.
 */
export function applyEventToVector(
  vector: TasteVector,
  { dimensions, event, meal }: TasteEventInput,
): TasteVector {
  const keys = dimensions.filter(Boolean)
  const next: TasteVector = {
    base: decayMap(vector.base),
    lunch: meal === 'lunch' ? decayMap(vector.lunch) : { ...vector.lunch },
    dinner: meal === 'dinner' ? decayMap(vector.dinner) : { ...vector.dinner },
  }

  if (!keys.length) return next

  const delta = EVENT_DELTA[event]
  next.base = applyDelta(next.base, keys, delta)
  next[meal] = applyDelta(next[meal], keys, delta * CONTEXT_EVENT_SCALE)

  return next
}

/** Convenience: one restaurant row -> its dimensions -> one event. */
export function applyRestaurantEvent(
  vector: TasteVector,
  restaurant: DimensionSource,
  event: TasteEvent,
  now: Date,
): TasteVector {
  return applyEventToVector(vector, {
    dimensions: dimensionsFor(restaurant),
    event,
    meal: mealContextFor(now),
  })
}

/**
 * Record one taste event and persist the updated profile.
 *
 * No-ops for anonymous callers: a null userId means we have nowhere to attach
 * the learning, and inventing a profile row would break the FK.
 */
export async function applyTasteEvent(
  userId: string | null | undefined,
  restaurant: DimensionSource | null | undefined,
  event: TasteEvent,
  now: Date = new Date(),
): Promise<TasteVector | null> {
  if (!userId || !restaurant) return null
  const dimensions = dimensionsFor(restaurant)
  if (!dimensions.length) return null

  const existing = await prisma.userTasteProfile.findUnique({ where: { userId } })
  const vector = applyRestaurantEvent(coerceVector(existing?.weights), restaurant, event, now)

  await saveVector(userId, vector)
  return vector
}

export interface RestaurantTasteEvent {
  restaurant: DimensionSource
  event: TasteEvent
}

/**
 * Batch form for the swipe log — one decay pass per event, applied in order, a
 * single read and a single write. Doing this through `applyTasteEvent` in a
 * loop would decay correctly but cost 2N queries.
 */
export async function applyTasteEvents(
  userId: string | null | undefined,
  events: RestaurantTasteEvent[],
  now: Date = new Date(),
): Promise<TasteVector | null> {
  if (!userId || !events.length) return null

  const existing = await prisma.userTasteProfile.findUnique({ where: { userId } })
  let vector = coerceVector(existing?.weights)
  for (const e of events) {
    if (!e.restaurant) continue
    if (!dimensionsFor(e.restaurant).length) continue
    vector = applyRestaurantEvent(vector, e.restaurant, e.event, now)
  }

  await saveVector(userId, vector)
  return vector
}

/** The one write. Stored as plain JSON — `weights` is already a Json column. */
async function saveVector(userId: string, vector: TasteVector): Promise<void> {
  const weights = vector as unknown as Prisma.InputJsonValue
  await prisma.userTasteProfile.upsert({
    where: { userId },
    create: { userId, weights },
    update: { weights },
  })
}

/** Current LEARNED vector for a user; empty for anonymous or not-yet-learned. */
export async function getTasteVector(
  userId: string | null | undefined,
): Promise<TasteVector> {
  if (!userId) return emptyVector()
  const row = await prisma.userTasteProfile.findUnique({ where: { userId } })
  return coerceVector(row?.weights)
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
 * ⚠️ STILL FLAT AND STILL CUISINE-ONLY, on purpose. The quiz asks about
 * cuisines and nothing else, so there is nothing to namespace at the point of
 * storage; `quizWeights` keeps the exact shape it has always had and older rows
 * need no migration. It is namespaced into `cuisine:` when it is summed with
 * the learned vector — see effectiveTasteVector.
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
    const key = normalizeDimensionValue(String(raw))
    if (key) out[key] = QUIZ_LOVE_DELTA
  }
  // Applied second so it wins a collision.
  for (const raw of dislikedCuisines ?? []) {
    const key = normalizeDimensionValue(String(raw))
    if (key) out[key] = QUIZ_DISLIKE_DELTA
  }

  return out
}

/**
 * Sum of two flat maps, clamped. The quiz SEEDS the profile without overwriting
 * it: a user who swiped right on Japanese ten times and then said they love
 * Japanese should end up more enthusiastic than either signal alone, not reset
 * to +2.
 */
export function effectiveTasteWeights(
  learned: TasteWeights,
  quiz: TasteWeights,
): TasteWeights {
  const out: TasteWeights = {}
  for (const key of new Set([...Object.keys(learned), ...Object.keys(quiz)])) {
    out[key] = clampWeight((learned[key] ?? 0) + (quiz[key] ?? 0))
  }
  return out
}

/**
 * What the engine actually scores against: the learned vector with the quiz's
 * cuisine weights folded into its BASE.
 *
 * The base, not a context map — a stated preference is not a statement about
 * lunch or about dinner, so it applies to both equally.
 */
export function effectiveTasteVector(
  learned: TasteVector,
  quiz: TasteWeights,
): TasteVector {
  return addToBase(learned, namespaceLegacyWeights(quiz))
}

/** Effective vector for a user — one query, both columns. */
export async function getEffectiveTasteVector(
  userId: string | null | undefined,
): Promise<TasteVector> {
  if (!userId) return emptyVector()
  const row = await prisma.userTasteProfile.findUnique({ where: { userId } })
  if (!row) return emptyVector()
  return effectiveTasteVector(coerceVector(row.weights), coerceWeights(row.quizWeights))
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

/** @deprecated Use `cuisineDimension` from ./tasteDimensions. */
export { cuisineDimension }
