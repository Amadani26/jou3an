/**
 * DecisionEngine v2 — translating an HTTP request into engine input.
 *
 * Kept pure and separate from the route so the mapping is unit-testable and so
 * the route stays about HTTP rather than about semantics.
 */
import type { Adventurousness, BudgetRange } from '@prisma/client'
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
  /**
   * Cuisines the user picked — a HARD Stage-1 filter (a union), not a weight.
   * See EngineContext.cuisines for why this stopped being a scoring boost.
   */
  cuisines?: string[]
  /**
   * Restaurants already shown for this brief, accumulated by Refresh. Removed
   * from the pool before selection; dropped wholesale if honouring them would
   * leave fewer than three (the engine then reports `cycled`).
   */
  excludeIds?: string[]
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
    cuisines: filters.cuisines ?? [],
    excludeIds: filters.excludeIds ?? [],
    // Only needs this filter can actually act on reach the engine, so a junk
    // value stored years ago can never silently shrink someone's pool.
    dietary: knownNeeds(prefs?.dietary),
    baseEpsilon: epsilonFor(prefs?.adventurousness),
    date,
    refreshNonce: filters.refreshNonce ?? 0,
  }
}
