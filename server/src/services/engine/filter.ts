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
import { conflictsWithDietary } from '../../lib/dietary'
import type { Budget, Candidate, EngineContext, FormatFilter, RadiusTier } from './types'

/** Minimum viable result set. Never returns fewer. */
export const REQUIRED = 3

/** Widest-last. A tier is used only if it can supply REQUIRED candidates. */
export const RADIUS_TIERS: { km: number; tier: RadiusTier }[] = [
  { km: 5, tier: 'NEARBY' },
  { km: 10, tier: 'WIDER' },
]

/**
 * AED-per-head bands, as the taste quiz's budget step words them.
 *
 * ⚠️ SCORING ONLY. These bands are read by `priceFit` in score.ts and by
 * NOTHING in this file — budget is not a Stage-1 constraint and must not become
 * one. A saved band used as a filter capped every future decision for a user
 * who answered one question once at signup: pick "Under AED 100" and the
 * engine would never again show you anywhere nicer, with nothing in the app
 * saying why. As a score term it does what the answer actually meant — a lean,
 * not a ceiling — so a better restaurant a little over the band can still win.
 *
 * 'ANY' (the quiz's "No budget", and the stored NULL it maps from) has no band:
 * `priceFit` returns NEUTRAL, leaving the price term inert.
 */
export const BUDGET_BANDS: Record<Exclude<Budget, 'ANY'>, { min: number; max: number }> = {
  LOW: { min: 0, max: 100 },
  MID: { min: 100, max: 200 },
  HIGH: { min: 200, max: Number.POSITIVE_INFINITY },
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
 *   format -> opening hours -> dietary.
 *
 * ⚠️ BUDGET IS NOT ON THIS LADDER, because it is not a constraint at all any
 * more — it is a score term (see BUDGET_BANDS above). There is nothing to
 * relax, so 'budget' can never appear in `relaxed[]`.
 *
 * Format goes first because eating in when you wanted delivery is the mildest
 * disappointment. Hours comes late because a shut restaurant is a bad thing to
 * hand someone who is hungry now — and DIETARY comes last of all, because
 * handing a vegan a
 * steakhouse is worse still: it is not an inconvenience, it is a result they
 * cannot use at all.
 *
 * ⚠️ The dietary rung is reached only when every looser brief has already
 * failed, which in practice means a catalogue of under ~10 servable rows. The
 * exclusion itself removes a small, well-defined set (~36 of 664 for
 * vegetarian), so on the real catalogue it never gets near the ladder. It is on
 * the ladder at all because "always exactly 3" is the one rule above it — see
 * src/lib/dietary.ts for what the available data can and cannot enforce.
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
  // Dietary sits just inside the hard gate: every rung below operates on the
  // already-excluded pool, and only the very last rung gives it up.
  const eligible = servable.filter((r) => !conflictsWithDietary(r, context.dietary))
  const open = eligible.filter((r) => isOpenNow(r, context.date))

  // Successively looser briefs; the first that yields REQUIRED wins.
  const attempts: { pool: Candidate[]; relaxed: string[] }[] = [
    {
      pool: open.filter((r) => matchesFormat(r, context.formatFilter)),
      relaxed: [],
    },
    { pool: open, relaxed: ['format'] },
    { pool: eligible, relaxed: ['format', 'hours'] },
    // Last resort. With no dietary needs declared this pool is identical to the
    // rung above, so it is unreachable and the word never appears in relaxed[].
    { pool: servable, relaxed: ['format', 'hours', 'dietary'] },
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
    relaxed: ['format', 'hours', 'dietary'],
  }
}
