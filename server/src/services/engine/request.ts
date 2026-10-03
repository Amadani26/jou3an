/**
 * DecisionEngine v2 — translating an HTTP request into engine input.
 *
 * Kept pure and separate from the route so the mapping is unit-testable and so
 * the route stays about HTTP rather than about semantics.
 */
import type { Adventurousness, BudgetRange } from '@prisma/client'
import { WEIGHT_MAX, normalizeCuisine, type TasteWeights } from '../tasteProfile'
import { knownNeeds } from '../../lib/dietary'
import { EPSILON, EPSILON_BY_ADVENTUROUSNESS } from './select'
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

/**
 * The User model's BudgetRange -> the engine's Budget.
 *
 * `User.budgetRange` is NULLABLE, and null is a real answer: the quiz's "No
 * budget" card. It maps to 'ANY', which makes the price term neutral rather
 * than picking a band on the user's behalf.
 */
export const BUDGET_MAP: Record<BudgetRange, Budget> = {
  LOW: 'LOW',
  MID: 'MID',
  HIGH: 'HIGH',
}

/** The Decide flow's budget pill wire values — including an explicit 'ANY'. */
export const BUDGET_WIRE: Record<string, Budget> = {
  LOW: 'LOW',
  MID: 'MID',
  HIGH: 'HIGH',
  ANY: 'ANY',
}

export interface RequestFilters {
  format?: string | null
  vibe?: string | null
  lat?: number | null
  lng?: number | null
  refreshNonce?: number | null
  /** Cuisines the user picked — carried through purely for reason wording. */
  cuisines?: string[]
  /**
   * A budget for THIS query, which outranks the user's saved band.
   *
   * Sent by the Decide flow's budget pill (the Vibe step). For a signed-in user
   * the pill ALSO saves the new band to their profile, so this field and the
   * stored one agree; for a guest it is the only way the choice can travel, and
   * it lasts exactly one query. The taste quiz's answer is a DEFAULT, and a
   * default is only a default if something can override it.
   */
  budget?: string | null
}

/**
 * The saved preferences the taste quiz writes, as the engine needs them.
 *
 * Every field is optional: anonymous callers pass null, and a user who skipped
 * the quiz has defaults that reproduce the engine's historical behaviour.
 */
export interface UserPrefs {
  /** Null = the quiz's "No budget" (or never answered) — see BUDGET_MAP. */
  budgetRange?: BudgetRange | null
  /** Declared dietary needs — a Stage-1 exclusion. See src/lib/dietary.ts. */
  dietary?: string[] | null
  /** Drives the per-user base wildcard ε. */
  adventurousness?: Adventurousness | null
}

/** Base ε for a user, or the engine default when they never answered. */
export function epsilonFor(
  adventurousness: Adventurousness | null | undefined,
): number {
  if (!adventurousness) return EPSILON
  return EPSILON_BY_ADVENTUROUSNESS[adventurousness] ?? EPSILON
}

/**
 * Anything unrecognised becomes 'ANY' rather than throwing: an older client
 * that omits these fields must still get a decision, just a less constrained
 * one.
 */
export function toEngineContext(
  filters: RequestFilters,
  prefs: UserPrefs | null | undefined,
  date: Date,
): EngineContext {
  // An explicit per-query budget wins; otherwise the saved band from the taste
  // quiz stands in; otherwise the price term is neutral. Note "constraint" is
  // the wrong word for all three: budget only ever moves `priceFit`.
  const queryBudget = filters.budget ? BUDGET_WIRE[filters.budget] : undefined
  const savedBudget = prefs?.budgetRange ? BUDGET_MAP[prefs.budgetRange] : undefined

  return {
    formatFilter: (filters.format && FORMAT_MAP[filters.format]) || 'ANY',
    vibe: (filters.vibe && VIBE_MAP[filters.vibe]) || 'ANY',
    budget: queryBudget ?? savedBudget ?? 'ANY',
    lat: typeof filters.lat === 'number' ? filters.lat : null,
    lng: typeof filters.lng === 'number' ? filters.lng : null,
    requestedCuisines: filters.cuisines ?? [],
    // Only needs this filter can actually act on reach the engine, so a junk
    // value stored years ago can never silently shrink someone's pool.
    dietary: knownNeeds(prefs?.dietary),
    baseEpsilon: epsilonFor(prefs?.adventurousness),
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
