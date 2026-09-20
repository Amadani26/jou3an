/**
 * DecisionEngine v2 — translating an HTTP request into engine input.
 *
 * Kept pure and separate from the route so the mapping is unit-testable and so
 * the route stays about HTTP rather than about semantics.
 */
import type { BudgetRange } from '@prisma/client'
import { WEIGHT_MAX, normalizeCuisine, type TasteWeights } from '../tasteProfile'
import type { Budget, EngineContext, FormatFilter, Vibe } from './types'

/** The Decide flow's wire values (human-readable) -> engine enums. */
export const FORMAT_MAP: Record<string, FormatFilter> = {
  Delivery: 'DELIVERY',
  'Dine In': 'DINE_IN',
}

export const VIBE_MAP: Record<string, Vibe> = {
  Casual: 'CASUAL',
  Fancy: 'FANCY',
}

/** The User model's BudgetRange -> the engine's Budget. */
export const BUDGET_MAP: Record<BudgetRange, Budget> = {
  LOW: 'LOW',
  MID: 'MID',
  HIGH: 'HIGH',
}

export interface RequestFilters {
  format?: string | null
  vibe?: string | null
  lat?: number | null
  lng?: number | null
  refreshNonce?: number | null
  /** Cuisines the user picked — carried through purely for reason wording. */
  cuisines?: string[]
}

/**
 * Anything unrecognised becomes 'ANY' rather than throwing: an older client
 * that omits these fields must still get a decision, just a less constrained
 * one.
 */
export function toEngineContext(
  filters: RequestFilters,
  budgetRange: BudgetRange | null | undefined,
  date: Date,
): EngineContext {
  return {
    formatFilter: (filters.format && FORMAT_MAP[filters.format]) || 'ANY',
    vibe: (filters.vibe && VIBE_MAP[filters.vibe]) || 'ANY',
    // The Decide flow has no budget step, so the signed-in user's saved
    // preference stands in. Anonymous callers get no budget constraint.
    budget: budgetRange ? BUDGET_MAP[budgetRange] : 'ANY',
    lat: typeof filters.lat === 'number' ? filters.lat : null,
    lng: typeof filters.lng === 'number' ? filters.lng : null,
    requestedCuisines: filters.cuisines ?? [],
    date,
    refreshNonce: filters.refreshNonce ?? 0,
  }
}

/**
 * Folds the cuisines the user explicitly asked for into their learned profile.
 *
 * ⚠️ Deliberate design choice: an explicit cuisine pick is treated as a very
 * strong TASTE signal for this one query, NOT as a hard Stage-1 filter.
 *
 * Filtering would fight two things at once. The catalogue usually holds a
 * single restaurant per cuisine, so a hard filter would trip the relaxation
 * ladder on nearly every request; and it would collide head-on with the
 * cuisine-diversity constraint, which exists so the three picks are not three
 * versions of the same meal. Weighting instead means a requested cuisine
 * reliably leads the ranking while the other two slots stay interesting.
 *
 * The boost is applied to a COPY and never persisted — the user's real profile
 * is only moved by actual swipes and selections.
 */
export function boostedTasteWeights(
  profile: TasteWeights,
  requestedCuisines: string[],
): TasteWeights {
  if (!requestedCuisines.length) return profile

  const boosted: TasteWeights = { ...profile }
  for (const raw of requestedCuisines) {
    const key = normalizeCuisine(raw)
    if (!key) continue
    // Pin to the ceiling: "I want Japanese tonight" should outrank whatever the
    // profile has learned, without inventing a weight outside the normal range
    // (the score normaliser maps [-5, 10] onto [0,1], so a larger number here
    // would clip rather than help).
    boosted[key] = WEIGHT_MAX
  }
  return boosted
}
