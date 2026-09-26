/**
 * DecisionEngine v2 — Stage 1: narrow the field.
 *
 * The hard constraint here is the product rule: ALWAYS exactly 3. So this is
 * not a plain filter — it is a filter plus a documented relaxation ladder. When
 * the strict brief yields fewer than three candidates we drop constraints in
 * order of how much a user would mind losing them, and report what we dropped
 * so the caller (and the DecisionLog) can see it.
 */
import { isOpenNow } from '../../lib/hours'
import { withinRadius, type Coords } from '../../lib/geo'
import { isServeable } from '../../lib/venueType'
import type { Budget, Candidate, EngineContext, FormatFilter, RadiusTier } from './types'

/** Minimum viable result set. Never returns fewer. */
export const REQUIRED = 3

/** Widest-last. A tier is used only if it can supply REQUIRED candidates. */
export const RADIUS_TIERS: { km: number; tier: RadiusTier }[] = [
  { km: 5, tier: 'NEARBY' },
  { km: 10, tier: 'WIDER' },
]

/** AED-per-head bands, matched against a restaurant's price range. */
export const BUDGET_BANDS: Record<Exclude<Budget, 'ANY'>, { min: number; max: number }> = {
  LOW: { min: 0, max: 60 },
  MID: { min: 40, max: 120 },
  HIGH: { min: 90, max: Number.POSITIVE_INFINITY },
}

export function matchesBudget(r: Candidate, budget: Budget): boolean {
  if (budget === 'ANY') return true
  const band = BUDGET_BANDS[budget]
  // Overlap, not containment: a 40–90 place suits both LOW and MID diners.
  return r.priceMin <= band.max && r.priceMax >= band.min
}

export function matchesFormat(r: Candidate, format: FormatFilter): boolean {
  if (format === 'ANY') return true
  if (format === 'DELIVERY') {
    return Boolean(r.talabatUrl || r.noonUrl || r.deliverooUrl)
  }
  // DINE_IN: every row in the catalogue is a physical restaurant, so there is
  // nothing to exclude. Kept explicit so the intent survives a future
  // delivery-only ghost-kitchen flag.
  return true
}

export interface FilterResult {
  pool: Candidate[]
  radiusKm: number | null
  radiusTier: RadiusTier
  /** Constraint names dropped to reach REQUIRED, in the order they were dropped. */
  relaxed: string[]
}

/** Applies the radius ladder to an already-constrained pool. */
function applyRadiusLadder(
  pool: Candidate[],
  origin: Coords | null,
): { pool: Candidate[]; radiusKm: number | null; radiusTier: RadiusTier } {
  if (!origin) return { pool, radiusKm: null, radiusTier: 'CITY' }

  for (const { km, tier } of RADIUS_TIERS) {
    const within = withinRadius(pool, origin, km)
    if (within.length >= REQUIRED) {
      return { pool: within, radiusKm: km, radiusTier: tier }
    }
  }
  // City-wide fallback — better a further restaurant than fewer than three.
  return { pool, radiusKm: null, radiusTier: 'CITY' }
}

/**
 * Stage 1. Constraints are dropped in this order when the pool is too small:
 *   budget -> format -> opening hours.
 *
 * Budget goes first because paying a bit more is the mildest disappointment,
 * and hours goes last because a shut restaurant is the worst thing to hand
 * someone who is hungry now.
 *
 * ⚠️ `isActive` and `venueType` are NOT on that ladder — they are absolute.
 * Deactivating a row (`npm run prune`) is a human saying "never serve this",
 * and a CAFE is parked for a feature that does not exist yet; relaxing either
 * one would quietly undo the curation. If fewer than three servable rows
 * remain, `decide()` throws instead — a thin catalogue is a catalogue problem,
 * not something to paper over with a de-listed restaurant.
 */
export function filterCandidates(
  candidates: Candidate[],
  context: EngineContext,
): FilterResult {
  const origin: Coords | null =
    typeof context.lat === 'number' && typeof context.lng === 'number'
      ? { lat: context.lat, lng: context.lng }
      : null

  // The hard gate, applied before anything that can be relaxed.
  const servable = candidates.filter(isServeable)
  const open = servable.filter((r) => isOpenNow(r, context.date))

  // Successively looser briefs; the first that yields REQUIRED wins.
  const attempts: { pool: Candidate[]; relaxed: string[] }[] = [
    {
      pool: open
        .filter((r) => matchesFormat(r, context.formatFilter))
        .filter((r) => matchesBudget(r, context.budget)),
      relaxed: [],
    },
    {
      pool: open.filter((r) => matchesFormat(r, context.formatFilter)),
      relaxed: ['budget'],
    },
    { pool: open, relaxed: ['budget', 'format'] },
    { pool: servable, relaxed: ['budget', 'format', 'hours'] },
  ]

  for (const attempt of attempts) {
    if (attempt.pool.length < REQUIRED) continue
    const laddered = applyRadiusLadder(attempt.pool, origin)
    if (laddered.pool.length >= REQUIRED) return { ...laddered, relaxed: attempt.relaxed }
  }

  // Everything was tried and the catalogue still cannot field three servable
  // rows. Hand back the widest LEGITIMATE pool; `select` will surface the
  // shortfall rather than this layer reaching for a parked or de-listed row.
  const laddered = applyRadiusLadder(servable, origin)
  return {
    ...laddered,
    relaxed: ['budget', 'format', 'hours'],
  }
}
