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
import { normalizeCuisine } from '../tasteProfile'
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
 * 'ANY' (the quiz's "Any budget", and the stored NULL it maps from) has no band:
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

/**
 * Does this restaurant's cuisine satisfy the user's explicit picks (a UNION)?
 *
 * Matching is substring-tolerant in BOTH directions, because the app's eight
 * cuisine tiles and the catalogue's free-text `cuisineType` are not the same
 * vocabulary: the tile says "American" while the importer writes both
 * "American" and "American Burgers". An exact compare would silently drop every
 * burger joint from an American brief — the worst possible failure for a filter
 * whose whole job is to honour what the user tapped.
 */
export function matchesCuisines(r: Candidate, cuisines: string[] | undefined): boolean {
  if (!cuisines?.length) return true
  const row = normalizeCuisine(r.cuisineType)
  if (!row) return false
  return cuisines.some((raw) => {
    const want = normalizeCuisine(raw)
    if (!want) return false
    return row.includes(want) || want.includes(row)
  })
}

export interface FilterResult {
  pool: Candidate[]
  radiusKm: number | null
  radiusTier: RadiusTier
  /** Constraint names dropped to reach REQUIRED, in the order they were dropped. */
  relaxed: string[]
  /**
   * True when `context.excludeIds` was abandoned to field three candidates —
   * the brief is exhausted and the pool has come back round to the top.
   */
  cycled: boolean
  /**
   * Rows that DO match the picked cuisines, populated only when the cuisine
   * filter had to break (i.e. 'cuisine' is in `relaxed`). Empty otherwise.
   *
   * ⚠️ This is what stops a thin cuisine from disappearing completely. Two of
   * the eight cuisines the app offers have fewer than three servable rows
   * (Emirati, Pakistani), so tapping one of those tiles reaches the cuisine
   * rung — and dropping the filter outright handed back three restaurants with
   * no Emirati among them at all, which is a worse answer than the one
   * restaurant we actually have. Stage 3 ranks these first, so the user gets
   * what exists of what they asked for, topped up to three.
   */
  pinned: Set<string>
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
 *   format -> opening hours -> cuisine -> dietary.
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
 * ⚠️ THE CUISINE FILTER OUTLIVES THE RADIUS LADDER, which is the whole point of
 * it. Each rung above runs the full 5 km -> 10 km -> city widening before the
 * next rung is considered, so a Japanese brief in a quiet neighbourhood reaches
 * across Dubai for Japanese rather than handing back the nearest pizza. Cuisine
 * is given up only on the second-to-last rung — when the picked cuisines cannot
 * field three rows ANYWHERE in the city even with hours ignored — and when it is
 * given up, 'cuisine' is reported in `relaxed[]` so the DecisionLog says so out
 * loud. It sits above dietary because a cuisine you did not ask for is a
 * disappointment, while a dietary conflict is a result you cannot eat.
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
  // The explicit cuisine picks, applied on top of dietary — every rung except
  // the last two is a cuisine the user actually asked for.
  const wanted = eligible.filter((r) => matchesCuisines(r, context.cuisines))
  const open = wanted.filter((r) => isOpenNow(r, context.date))

  // Successively looser briefs; the first that yields REQUIRED wins.
  const attempts: { pool: Candidate[]; relaxed: string[] }[] = [
    {
      pool: open.filter((r) => matchesFormat(r, context.formatFilter)),
      relaxed: [],
    },
    { pool: open, relaxed: ['format'] },
    { pool: wanted, relaxed: ['format', 'hours'] },
    // The picked cuisines cannot field three rows city-wide. With no cuisines
    // picked this pool is identical to the rung above, so it is unreachable and
    // 'cuisine' never appears in relaxed[].
    { pool: eligible, relaxed: ['format', 'hours', 'cuisine'] },
    // Last resort. With no dietary needs declared this pool is identical to the
    // rung above, so it is unreachable and the word never appears in relaxed[].
    { pool: servable, relaxed: ['format', 'hours', 'cuisine', 'dietary'] },
  ]

  for (const attempt of attempts) {
    if (attempt.pool.length < REQUIRED) continue
    const laddered = applyRadiusLadder(attempt.pool, origin)
    if (laddered.pool.length >= REQUIRED) {
      return withExclusions(
        { ...laddered, relaxed: attempt.relaxed, pinned: pinnedFor(laddered.pool, attempt.relaxed, context) },
        context,
      )
    }
  }

  // Everything was tried and the catalogue still cannot field three servable
  // rows. Hand back the widest LEGITIMATE pool; `select` will surface the
  // shortfall rather than this layer reaching for a parked or de-listed row.
  const relaxed = ['format', 'hours', 'cuisine', 'dietary']
  const laddered = applyRadiusLadder(servable, origin)
  return withExclusions(
    { ...laddered, relaxed, pinned: pinnedFor(laddered.pool, relaxed, context) },
    context,
  )
}

/**
 * The rows that still match the picked cuisines, but only once the cuisine
 * filter has been given up.
 *
 * While the filter holds, EVERY row in the pool matches, so pinning would mean
 * nothing — the empty set keeps Stage 3's ranking untouched on the normal path.
 */
function pinnedFor(
  pool: Candidate[],
  relaxed: string[],
  context: EngineContext,
): Set<string> {
  if (!relaxed.includes('cuisine') || !context.cuisines?.length) return new Set()
  return new Set(
    pool.filter((r) => matchesCuisines(r, context.cuisines)).map((r) => r.id),
  )
}

/**
 * Removes what the user has already been shown for this brief — the ids Refresh
 * accumulates — from a pool the ladder has already settled on.
 *
 * ⚠️ Applied AFTER the ladder, deliberately. Exclusions must not be able to
 * loosen the brief: `relaxed[]` is read as evidence that the CATALOGUE was too
 * thin for what was asked, and a user on their fourth Refresh dropping 'hours'
 * into that signal would be noise. So the rung and the radius are decided by
 * the brief alone, and the exclusions are then taken off the top.
 *
 * When too few survive, the whole set is dropped rather than partially honoured
 * and `cycled` is set: the user has seen everything this brief holds, and
 * showing them the three best again (with the UI saying so, once) is the honest
 * answer. Honouring some ids and not others would silently serve the leftovers.
 */
function withExclusions(
  result: Omit<FilterResult, 'cycled'>,
  context: EngineContext,
): FilterResult {
  const excluded = new Set(context.excludeIds ?? [])
  if (!excluded.size) return { ...result, cycled: false }

  const trimmed = result.pool.filter((r) => !excluded.has(r.id))
  if (trimmed.length >= REQUIRED) return { ...result, pool: trimmed, cycled: false }

  return { ...result, cycled: true }
}
